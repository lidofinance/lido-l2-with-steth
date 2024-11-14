import readline from "readline";

function prompt(question: string, availableAnswers?: string[]) {
  const rdl = readline.createInterface(process.stdin, process.stdout);
  return new Promise<string>((resolve, reject) => {
    rdl.question(`${question}\n`, (answer) => {
      rdl.close();
      if (!availableAnswers) {
        return resolve(answer);
      }
      if (availableAnswers.includes(answer)) {
        return resolve(answer);
      }
      reject(new Error("Invalid Answer: Please respond with 'yes' or 'no'"));
    });
  });
}

async function promptProceed() {
  if (process.env.L2_DEPLOY_SKIP_PROMPTS) {
    return;
  }

  const positiveAnswers = ["y", "yes"];
  const negativeAnswers = ["n", "no"];
  const answer = await prompt("Do you want to proceed? [yes/no]", [
    ...positiveAnswers,
    ...negativeAnswers,
  ]);
  if (negativeAnswers.includes(answer)) {
    throw new Error("User discarded prompt to proceed");
  }
}

export default { proceed: promptProceed, message: prompt };
