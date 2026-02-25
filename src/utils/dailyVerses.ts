import { Verse, verses } from "../data/verses";

/**
 * Retorna 10 versículos determinísticos baseados na data atual.
 * A seleção muda apenas quando o dia muda.
 */
export function getDailyVerses(): Verse[] {
  const now = new Date();
  // Cria uma string estável para o dia atual (ex: "2026-02-25")
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  
  // Função simples de hash para gerar um número a partir da data
  const seed = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const selectedVerses: Verse[] = [];
  const totalVerses = verses.length;
  
  // Usamos o seed para escolher 10 versículos de forma determinística
  for (let i = 0; i < 10; i++) {
    // Um algoritmo simples para variar o índice baseado na posição e no seed
    // Adicionamos i * 13 para garantir que os índices sejam diferentes entre si
    const index = (seed + (i * 17)) % totalVerses;
    
    // Evita duplicatas (embora com 120 versículos e 10 escolhas seja improvável com este mod)
    let finalIndex = index;
    while (selectedVerses.some(v => v.text === verses[finalIndex].text)) {
      finalIndex = (finalIndex + 1) % totalVerses;
    }
    
    selectedVerses.push(verses[finalIndex]);
  }
  
  return selectedVerses;
}
