// Builds a minimal but structurally valid PDF (correct xref offsets).
const fs = require("node:fs");

const lines = [
  "BT /F1 24 Tf 72 700 Td (Quantum Mechanics Lecture Notes) Tj ET",
  "BT /F1 14 Tf 72 660 Td (The wave function psi describes a quantum system.) Tj ET",
  "BT /F1 14 Tf 72 640 Td (The Schrodinger equation evolves the wave function in time.) Tj ET",
  "BT /F1 14 Tf 72 620 Td (Energy levels are quantised for bound systems.) Tj ET",
];
const stream = lines.join("\n");

const objects = [
  "<</Type/Catalog/Pages 2 0 R>>",
  "<</Type/Pages/Kids[3 0 R]/Count 1>>",
  "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
  `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
];

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";
offsets.forEach((o) => {
  pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
});
pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;

fs.writeFileSync("scripts/test-lecture.pdf", pdf, "binary");
console.log("written bytes:", pdf.length);

const pdfParse = require("pdf-parse");
pdfParse(fs.readFileSync("scripts/test-lecture.pdf"))
  .then((d) => console.log("parse OK, pages:", d.numpages, "text len:", d.text.length))
  .catch((e) => console.log("parse FAILED:", e.message));
