export function skillDocument(name: string, instructions: string): string {
  return `---\nname: ${name}\ndescription: Exercise the authored skill release lifecycle.\n---\n\n# Instructions\n${instructions}`;
}
