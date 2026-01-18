import { Topic } from "@shared/schema";

export interface IStorage {
  // No user storage needed for MVP
}

export class MemStorage implements IStorage {
  constructor() {
    // No state needed
  }
}

export const storage = new MemStorage();
