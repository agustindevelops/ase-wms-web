export class AtHomeExperienceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtHomeExperienceError";
  }
}
