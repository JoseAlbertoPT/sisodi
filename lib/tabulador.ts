export const RANGOS_TABULADOR = [
  
  
  
  
  {min: 32124.36 , max : 49846.50, nivel: "105", categoria: "A"},
  
  
  
  
    {min: 24380.00, max : 32123.30, nivel: "106", categoria: "A"},

  
  
  
  
    {min: 19080.00, max : 24369.40 ,  nivel: "107", categoria: "A"},

  
 
  
  
    {min: 0.00, max : 18830.90 ,  nivel: "108", categoria: "A"},

  
  
  
  
  { min: 0.00, max: 13292.40, nivel: "109", categoria: "A" },

  
  { min: 11660.00, max: 15898.94, nivel: "301", categoria: "A" },

  
  { min: 10554.00, max: 11658.94, nivel: "302", categoria: "A" },

  
  { min: 0.00,     max: 10553.36, nivel: "303", categoria: "A" },

  

  
  { min: 0.00,     max: 49847.00, nivel: "504", categoria: "ÚNICA" },

  
  
  
  { min: 0.00,     max: 47631.00, nivel: "505", categoria: "A" },

  
 
  
  { min: 0.00,     max: 44308.00, nivel: "506", categoria: "A" },

  
  
  
  { min: 0.00,     max: 40985.00, nivel: "507", categoria: "A" },

  

  
  { min: 0.00,     max: 36554.00, nivel: "508", categoria: "A" },

  
  
  
  { min: 0.00,     max: 33231.00, nivel: "509", categoria: "A" },

  
  
  
    { min: 0.00,     max: 31569.00, nivel: "510", categoria: "A" },

]

const fmt = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function formatRangoTabulador(nivel: string | null | undefined, categoria: string | null | undefined): string | null {
  if (!nivel) return null
  const rango = RANGOS_TABULADOR.find(
    r => r.nivel === nivel && (categoria ? r.categoria === categoria : true)
  )
  if (!rango) return null
  return `${rango.nivel}   ${fmt(rango.min)} a ${fmt(rango.max)}`
}
