//interface for the project fields

interface ProjectFields {
  title: string;
  description: string;
  people: number;
}

//validation

interface Validatable {
  value: string | number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

//drag and drop interface

interface Draggable {
  DragStartHandler(event: DragEvent): void;
  DragEndHandler(event: DragEvent): void;
}

interface DragTarget {
  DragOverHandler(event: DragEvent): void;
  DropHandler(event: DragEvent): void;
  DragLeaveHandler(event: DragEvent): void;
}

function Validate(validateInput: Validatable) {
  let isValid = true;
  if (validateInput.required) {
    isValid = isValid && validateInput.value.toString().trim().length !== 0;
  }

  if (
    validateInput.minLength != null &&
    typeof validateInput.value === "string"
  ) {
    isValid = isValid && validateInput.value.length >= validateInput.minLength;
  }

  if (
    validateInput.maxLength != null &&
    typeof validateInput.value === "string"
  ) {
    isValid = isValid && validateInput.value.length <= validateInput.maxLength;
  }

  if (validateInput.min != null && typeof validateInput.value === "number") {
    isValid = isValid && validateInput.value >= validateInput.min;
  }

  if (validateInput.max != null && typeof validateInput.value === "number") {
    isValid = isValid && validateInput.value <= validateInput.max;
  }

  return isValid;
}

//autobind decorator

function autobind(_: any, _2: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const adjDescriptor: PropertyDescriptor = {
    configurable: true,
    get() {
      const boundFn = originalMethod.bind(this);
      return boundFn;
    },
  };

  return adjDescriptor;
}

/*
    Project classes location to make it easier to understand where is stuff once im using just one
    file. 
*/

//project type

enum ProjectStatus {
  active,
  finished,
}

class Project {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public people: number,
    public status: ProjectStatus
  ) {}
}

// Project state class
//state mangt

type Listener<T> = (items: T[]) => void;

class State<T> {
  protected listeners: Listener<T>[] = [];

  AddListener(listenerFn: Listener<T>) {
    this.listeners.push(listenerFn);
  }
}

class ProjectState extends State<Project> {
  private projects: Project[] = [];
  private static instance: ProjectState;

  private constructor() {
    super();
  }

  static getInstance() {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new ProjectState();
    return this.instance;
  }

  AddProject(fields: ProjectFields) {
    const newProject = new Project(
      Math.random.toString(),
      fields.title,
      fields.description,
      fields.people,
      ProjectStatus.active
    );

    this.projects.push(newProject);
    this.UpdateListeners();
  }

  MoveProject(projectId: string, newStatus: ProjectStatus) {
    const project = this.projects.find((prj) => prj.id === projectId);

    if (project && project.status !== newStatus) {
      project.status = newStatus;
      this.UpdateListeners();
    }
  }

  private UpdateListeners() {
    for (const listenerFn of this.listeners) {
      listenerFn(this.projects.slice());
    }
  }
}

const projectState = ProjectState.getInstance();

//Component base class

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  templateElement: HTMLTemplateElement;
  hostElement: T;
  element: U;

  constructor(
    templateId: string,
    hostElementId: string,
    insertAtStart: boolean,
    newElementId?: string
  ) {
    this.templateElement = document.getElementById(
      templateId
    )! as HTMLTemplateElement;
    this.hostElement = document.getElementById(hostElementId)! as T;

    const importedNode = document.importNode(
      this.templateElement.content,
      true
    );

    this.element = importedNode.firstElementChild as U;
    if (newElementId) {
      this.element.id = newElementId;
    }

    this.attach(insertAtStart);
  }

  private attach(insertAtBeginning: boolean) {
    this.hostElement.insertAdjacentElement(
      insertAtBeginning ? "afterbegin" : "beforeend",
      this.element
    );
  }

  abstract Configure(): void;
  abstract RenderContent(): void;
}

//ProjectItem Class

class ProjectItem
  extends Component<HTMLUListElement, HTMLLIElement>
  implements Draggable
{
  private project: Project;

  get persons() {
    return this.project.people <= 1
      ? "1 Person Assigned to the project"
      : `${this.project.people} Persons Assigned To the Project.`;
  }

  constructor(hostId: string, project: Project) {
    super("single-project", hostId, false, project.id);
    this.project = project;

    this.Configure();
    this.RenderContent();
  }

  @autobind
  DragStartHandler(event: DragEvent) {
    event.dataTransfer!.setData("text/plain", this.project.id);
    event.dataTransfer!.effectAllowed = "move";
  }

  @autobind
  DragEndHandler(_: DragEvent): void {
    console.log("drag ended");
  }

  Configure() {
    this.element.addEventListener("dragstart", this.DragStartHandler);
    this.element.addEventListener("dragend", this.DragEndHandler);
  }

  RenderContent() {
    this.element.querySelector("h2")!.textContent = this.project.title;
    this.element.querySelector("h3")!.textContent = this.persons;
    this.element.querySelector("p")!.textContent = this.project.description;
  }
}

//Project List class

class ProjectList
  extends Component<HTMLDivElement, HTMLElement>
  implements DragTarget
{
  assignedProject: Project[];

  constructor(private type: "active" | "finished") {
    super("project-list", "app", false, `${type}-projects`);
    this.assignedProject = [];

    this.Configure();
    this.RenderContent();
  }

  @autobind
  DragOverHandler(event: DragEvent) {
    if (event.dataTransfer && event.dataTransfer.types[0] === "text/plain") {
      //we need to set this on drag over
      event.preventDefault();
      const listEl = this.element.querySelector("ul")!;
      listEl.classList.add("droppable");
    }
  }

  @autobind
  DropHandler(event: DragEvent) {
    const prjtId = event.dataTransfer!.getData("text/plain");
    projectState.MoveProject(
      prjtId,
      this.type === "active" ? ProjectStatus.active : ProjectStatus.finished
    );
  }

  @autobind
  DragLeaveHandler(_: DragEvent) {
    const listEl = this.element.querySelector("ul")!;
    listEl.classList.remove("droppable");
  }

  Configure() {
    //make the drag add an event to the target

    this.element.addEventListener("dragover", this.DragOverHandler);
    this.element.addEventListener("dragleave", this.DragLeaveHandler);
    this.element.addEventListener("drop", this.DropHandler);

    projectState.AddListener((projects: Project[]) => {
      const relevantProjects = projects.filter((prj) => {
        if (this.type === "active") {
          return prj.status === ProjectStatus.active;
        }
        return prj.status === ProjectStatus.finished;
      });

      this.assignedProject = relevantProjects;
      this.RenderProject();
    });
  }

  RenderContent() {
    const listId = `${this.type}-projects-list`;
    this.element.querySelector("ul")!.id = listId;
    this.element.querySelector(
      "h2"
    )!.textContent = `${this.type.toUpperCase()} PROJECTS`;
  }

  private RenderProject() {
    const listEl = document.getElementById(
      `${this.type}-projects-list`
    )! as HTMLUListElement;
    listEl.innerHTML = "";
    for (const projectItem of this.assignedProject) {
      new ProjectItem(this.element.querySelector("ul")!.id, projectItem);
    }
  }
}

//Project input class

class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
  titleInput: HTMLInputElement;
  descriptionInput: HTMLInputElement;
  peopleInput: HTMLInputElement;

  constructor() {
    super("project-input", "app", true, "user-input");
    this.titleInput = this.element.querySelector("#title") as HTMLInputElement;
    this.descriptionInput = this.element.querySelector(
      "#description"
    ) as HTMLInputElement;
    this.peopleInput = this.element.querySelector(
      "#people"
    ) as HTMLInputElement;

    this.Configure();
  }

  Configure() {
    this.element.addEventListener("submit", this.submitHandler);
  }

  RenderContent() {}

  private GatherUserInput(): [string, string, number] | void {
    const enteredTitle = this.titleInput.value;
    const enteredDescription = this.descriptionInput.value;
    const enteredPeople = this.peopleInput.value;

    const titleValidatable: Validatable = {
      value: enteredTitle,
      required: true,
    };

    const descriptionValidatable: Validatable = {
      value: enteredDescription,
      required: true,
      minLength: 5,
    };

    const peopleValidatable: Validatable = {
      value: enteredPeople,
      required: true,
      min: 1,
      max: 5,
    };

    if (
      !Validate(titleValidatable) ||
      !Validate(descriptionValidatable) ||
      !Validate(peopleValidatable)
    ) {
      alert("Invalid input please try again");
      return;
    } else {
      return [enteredTitle, enteredDescription, +enteredPeople];
    }
  }

  private ClearInputs() {
    this.titleInput.value = "";
    this.descriptionInput.value = "";
    this.peopleInput.value = "";
  }

  @autobind
  private submitHandler(event: Event) {
    event.preventDefault();
    const userInput = this.GatherUserInput();
    if (Array.isArray(userInput)) {
      const [projectTitle, projectDesc, projectPeople] = userInput;

      const projectFields: ProjectFields = {
        title: projectTitle,
        description: projectDesc,
        people: projectPeople,
      };

      projectState.AddProject(projectFields);
      this.ClearInputs();
    }
  }
}

const prjInput = new ProjectInput();
const activeProjectList = new ProjectList("active");
const finishedProjectList = new ProjectList("finished");
