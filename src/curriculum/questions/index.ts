import { u01, u02, u03, u04, u05 } from './bank01to05'
import { u06, u07, u08, u09, u10 } from './bank06to10'
import { u11, u12, u13, u14, u15 } from './bank11to15'
import { u16, u17, u18, u19, u20 } from './bank16to20'
import type { QuestionGen } from './types'

export const BANKS: Record<string, QuestionGen[]> = {
  u01, u02, u03, u04, u05, u06, u07, u08, u09, u10,
  u11, u12, u13, u14, u15, u16, u17, u18, u19, u20,
}
