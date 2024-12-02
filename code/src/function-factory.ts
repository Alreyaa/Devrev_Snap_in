import on_work_creation from './functions/on_work_creation';
import { nlp } from './functions/on_work_creation/mainFunction';
/* All the tags reveived is stored in src/fixtures/on_bug_report_event.json file  */
/* To run the server : npm run start:server */

export const functionFactory = {
  nlp,
  on_work_creation,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
