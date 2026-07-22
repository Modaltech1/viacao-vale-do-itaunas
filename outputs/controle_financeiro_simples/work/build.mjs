import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const workDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(workDir, '..');
const previewDir = path.join(outDir, 'previews');
await fs.mkdir(previewDir, { recursive: true });

const workbook = Workbook.create();
const lanc = workbook.worksheets.add('Lançamentos');
const resumo = workbook.worksheets.add('Resumo Mensal');

const navy = '#0F172A';
const slate = '#475569';
const border = '#CBD5E1';
const headerFill = '#E2E8F0';
const greenFill = '#DCFCE7';
const redFill = '#FEE2E2';
const blueFill = '#E0F2FE';
const amberFill = '#FEF3C7';

for (const sheet of [lanc, resumo]) {
  sheet.showGridLines = false;
}

function formatTitle(sheet, range, title, subtitle) {
  sheet.getRange(range).merge();
  sheet.getRange(range).values = [[title]];
  sheet.getRange(range).format = {
    fill: navy,
    font: { color: '#FFFFFF', bold: true, size: 15 },
    verticalAlignment: 'center',
  };
  const subtitleRange = range.replace(/1/g, '2');
  sheet.getRange(subtitleRange).merge();
  sheet.getRange(subtitleRange).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: navy,
    font: { color: '#DDE7F2', size: 10 },
    verticalAlignment: 'center',
  };
}

function formatHeader(range) {
  range.format = {
    fill: headerFill,
    font: { bold: true, color: navy },
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    borders: { preset: 'outside', style: 'thin', color: border },
  };
}

// Lançamentos
formatTitle(
  lanc,
  'A1:K1',
  'Controle financeiro simples',
  'Preencha uma linha por receita ou custo. A taxa da maquininha vem por padrão em 4,98% quando marcada como Sim.',
);
lanc.getRange('A4:B6').values = [
  ['Taxa padrão maquininha', 0.0498],
  ['Ano do resumo', 2026],
  ['Observação', 'Edite as linhas abaixo livremente mês a mês.'],
];
lanc.getRange('A4:A6').format = { fill: headerFill, font: { bold: true, color: navy } };
lanc.getRange('B4').format.numberFormat = '0.00%';
lanc.getRange('B5').format.numberFormat = '0';
lanc.getRange('B6').format = { font: { color: slate } };

lanc.getRange('A8:K8').values = [[
  'Data', 'Mês', 'Tipo', 'Categoria', 'Descrição', 'Quantidade', 'Valor unitário',
  'Valor bruto', 'Aplicar taxa?', 'Taxa maquininha', 'Valor líquido'
]];
formatHeader(lanc.getRange('A8:K8'));

lanc.getRange('A9:K208').format = {
  borders: { insideHorizontal: { style: 'thin', color: '#E2E8F0' } },
  verticalAlignment: 'center',
};
lanc.getRange('A9:A208').format.numberFormat = 'yyyy-mm-dd';
lanc.getRange('B9:B208').format.numberFormat = 'mmm yyyy';
lanc.getRange('F9:F208').format.numberFormat = '#,##0.00';
lanc.getRange('G9:H208').format.numberFormat = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
lanc.getRange('J9:K208').format.numberFormat = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';

lanc.getRange('B9').formulas = [['=IF(A9="","",DATE(YEAR(A9),MONTH(A9),1))']];
lanc.getRange('B9:B208').fillDown();
lanc.getRange('H9').formulas = [['=IF(OR(F9="",G9=""),"",F9*G9)']];
lanc.getRange('H9:H208').fillDown();
lanc.getRange('J9').formulas = [['=IF(I9="Sim",H9*$B$4,0)']];
lanc.getRange('J9:J208').fillDown();
lanc.getRange('K9').formulas = [['=IF(H9="","",IF(C9="Receita",H9-J9,-H9-J9))']];
lanc.getRange('K9:K208').fillDown();

lanc.getRange('A9:K13').values = [
  [new Date(2026, 0, 10), null, 'Receita', 'Implantação', 'Implantação do sistema', 1, 15000, null, 'Não', null, null],
  [new Date(2026, 0, 20), null, 'Custo', 'Servidor', 'Servidor / hospedagem', 1, 250, null, 'Não', null, null],
  [new Date(2026, 0, 20), null, 'Custo', 'Domínio', 'Domínio anual rateado ou pago no mês', 1, 80, null, 'Não', null, null],
  [new Date(2026, 1, 10), null, 'Receita', 'Mensalidade', 'Mensalidade recebida no cartão', 1, 3000, null, 'Sim', null, null],
  [new Date(2026, 1, 20), null, 'Custo', 'Banco', 'Taxa bancária do mês', 1, 50, null, 'Não', null, null],
];
// Restore formulas in calculated columns after writing examples.
lanc.getRange('B9').formulas = [['=IF(A9="","",DATE(YEAR(A9),MONTH(A9),1))']];
lanc.getRange('B9:B208').fillDown();
lanc.getRange('H9').formulas = [['=IF(OR(F9="",G9=""),"",F9*G9)']];
lanc.getRange('H9:H208').fillDown();
lanc.getRange('J9').formulas = [['=IF(I9="Sim",H9*$B$4,0)']];
lanc.getRange('J9:J208').fillDown();
lanc.getRange('K9').formulas = [['=IF(H9="","",IF(C9="Receita",H9-J9,-H9-J9))']];
lanc.getRange('K9:K208').fillDown();

lanc.getRange('C9:C208').dataValidation = { rule: { type: 'list', values: ['Receita', 'Custo'] } };
lanc.getRange('I9:I208').dataValidation = { rule: { type: 'list', values: ['Sim', 'Não'] } };
lanc.freezePanes.freezeRows(8);
lanc.getRange('A:A').format.columnWidth = 13;
lanc.getRange('B:B').format.columnWidth = 13;
lanc.getRange('C:C').format.columnWidth = 12;
lanc.getRange('D:D').format.columnWidth = 18;
lanc.getRange('E:E').format.columnWidth = 34;
lanc.getRange('F:K').format.columnWidth = 15;

// Resumo mensal
formatTitle(
  resumo,
  'A1:H1',
  'Resumo mensal automático',
  'Consolida receita, custos, taxa da maquininha e resultado líquido a partir da aba Lançamentos.',
);
resumo.getRange('A4:H4').values = [[
  'Mês', 'Receita bruta', 'Taxa maquininha', 'Receita líquida', 'Custos', 'Resultado líquido', 'Margem', 'Observação'
]];
formatHeader(resumo.getRange('A4:H4'));

for (let row = 5; row <= 16; row += 1) {
  const month = row - 4;
  resumo.getRange(`A${row}`).formulas = [[`=DATE('Lançamentos'!$B$5,${month},1)`]];
  resumo.getRange(`B${row}`).formulas = [[`=SUMIFS('Lançamentos'!$H$9:$H$208,'Lançamentos'!$B$9:$B$208,A${row},'Lançamentos'!$C$9:$C$208,"Receita")`]];
  resumo.getRange(`C${row}`).formulas = [[`=SUMIFS('Lançamentos'!$J$9:$J$208,'Lançamentos'!$B$9:$B$208,A${row},'Lançamentos'!$C$9:$C$208,"Receita")`]];
  resumo.getRange(`D${row}`).formulas = [[`=B${row}-C${row}`]];
  resumo.getRange(`E${row}`).formulas = [[`=SUMIFS('Lançamentos'!$H$9:$H$208,'Lançamentos'!$B$9:$B$208,A${row},'Lançamentos'!$C$9:$C$208,"Custo")+SUMIFS('Lançamentos'!$J$9:$J$208,'Lançamentos'!$B$9:$B$208,A${row},'Lançamentos'!$C$9:$C$208,"Custo")`]];
  resumo.getRange(`F${row}`).formulas = [[`=D${row}-E${row}`]];
  resumo.getRange(`G${row}`).formulas = [[`=IFERROR(F${row}/B${row},0)`]];
  resumo.getRange(`H${row}`).formulas = [[`=IF(B${row}+E${row}=0,"Sem lançamentos","OK")`]];
}
resumo.getRange('A5:A16').format.numberFormat = 'mmm yyyy';
resumo.getRange('B5:F16').format.numberFormat = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
resumo.getRange('G5:G16').format.numberFormat = '0.0%';
resumo.getRange('A5:H16').format = {
  borders: { insideHorizontal: { style: 'thin', color: '#E2E8F0' } },
};
resumo.getRange('A19:F19').values = [['Total anual', '=SUM(B5:B16)', '=SUM(C5:C16)', '=SUM(D5:D16)', '=SUM(E5:E16)', '=SUM(F5:F16)']];
resumo.getRange('A19:F19').format = {
  fill: blueFill,
  font: { bold: true, color: navy },
  borders: { preset: 'outside', style: 'thin', color: border },
};
resumo.getRange('B19:F19').format.numberFormat = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
resumo.getRange('A:H').format.columnWidth = 18;
resumo.getRange('H:H').format.columnWidth = 22;
resumo.freezePanes.freezeRows(4);

// Light visual cues
resumo.getRange('B5:D16').format.fill = greenFill;
resumo.getRange('E5:E16').format.fill = redFill;
resumo.getRange('C5:C16').format.fill = amberFill;
lanc.getRange('A4:B6').format.borders = { preset: 'outside', style: 'thin', color: border };

const inspect = await workbook.inspect({ kind: 'table', sheetId: 'Resumo Mensal', range: 'A1:H19', include: 'values,formulas', tableMaxRows: 20, tableMaxCols: 8, maxChars: 5000 });
console.log(inspect.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'formula error scan' });
console.log(errors.ndjson);
for (const sheetName of ['Lançamentos', 'Resumo Mensal']) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, `${sheetName.replace(/[^a-z0-9]+/gi, '_')}.png`), new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outDir, 'controle_financeiro_simples.xlsx'));
console.log('SAVED ' + path.join(outDir, 'controle_financeiro_simples.xlsx'));

