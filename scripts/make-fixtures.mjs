import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
mkdirSync(root, { recursive: true })

function buildPdf(objects) {
  let output = "%PDF-1.4\n"
  const xref = [0]
  for (let index = 0; index < objects.length; index += 1) {
    xref.push(Buffer.byteLength(output))
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const startxref = Buffer.byteLength(output)
  output += `xref\n0 ${objects.length + 1}\n`
  output += "0000000000 65535 f \n"
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(xref[index]).padStart(10, "0")} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`
  return Buffer.from(output, "latin1")
}

function textPage(text, width, height, y) {
  const stream = `BT /F1 24 Tf 48 ${y} Td (${text}) Tj ET`
  return [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
}

writeFileSync(join(root, "plain.pdf"), buildPdf(textPage("Hello", 420, 240, 120)))
writeFileSync(join(root, "tall.pdf"), buildPdf(textPage("TALL PAGE", 420, 2400, 2200)))
writeFileSync(
  join(root, "三体.pdf"),
  buildPdf(textPage("San Ti", 420, 240, 120)),
)

const red = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0])
const blue = Buffer.from([0, 0, 255, 255, 255, 255, 0, 255, 0, 255, 0, 255])
const content = "q 90 0 0 90 40 40 cm /Im1 Do Q q 70 0 0 70 180 40 cm /Im2 Do Q"
const imageObjects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R /Im2 6 0 R >> >> >>",
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  `<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${red.length} >>\nstream\n${red.toString("latin1")}\nendstream`,
  `<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${blue.length} >>\nstream\n${blue.toString("latin1")}\nendstream`,
]
writeFileSync(join(root, "images.pdf"), buildPdf(imageObjects))

const pageOne = "BT /F1 24 Tf 48 140 Td (Page One) Tj ET"
const pageTwo = "BT /F1 24 Tf 48 140 Td (Page Two) Tj ET"
writeFileSync(
  join(root, "two-pages.pdf"),
  buildPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
    `<< /Length ${pageOne.length} >>\nstream\n${pageOne}\nendstream`,
    `<< /Length ${pageTwo.length} >>\nstream\n${pageTwo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]),
)

console.log(root)
