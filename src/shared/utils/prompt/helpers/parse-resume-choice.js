// -------- Parse Resume Choice --------
export function parseResumeChoice(answer) {
  switch (answer.toLowerCase()) {
    case 'f': case 'fresh': case 'restart': return 'restart';
    case 'a': case 'abort': case 'q': case 'quit': return 'abort';
    case 'r': case 'resume': case '': return 'resume';
    default:
      console.error(`  Unrecognized choice "${answer}", defaulting to resume.`);
      return 'resume';
  }
}
