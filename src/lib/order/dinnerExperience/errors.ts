export class DinnerExperienceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DinnerExperienceError";
  }
}
