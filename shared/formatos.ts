/** Extensiones que el lector intenta. El selector del navegador usa la misma lista. */
export const EXTENSIONES_EXTRACTO = [
  'csv',
  'tsv',
  'txt',
  'pdf',
  'n43',
  'c43',
  'csb43',
  'aeb43',
  'sta',
  'xls',
  'xlsx',
  'xlsm',
  'xlsb',
  'ods',
  'numbers',
] as const

export const ACCEPT_FICHEROS = EXTENSIONES_EXTRACTO.map((ext) => `.${ext}`).join(',')
