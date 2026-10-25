import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

root = Path("/Users/hiro/Projects/pdf-page-export/fixtures")
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Songti.ttc", 64, index=0)

image = Image.new("RGB", (480, 220), "white")
draw = ImageDraw.Draw(image)
draw.text((36, 70), "三体", fill=(20, 20, 20), font=font)
raw = image.tobytes()
compressed = zlib.compress(raw)
width, height = image.size
content = f"q {width} 0 0 {height} 20 20 cm /Im1 Do Q".encode("latin1")
objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 520 260] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>",
    b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
    b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n"
    % (width, height, len(compressed))
    + compressed
    + b"\nendstream",
]


def build(objects):
    output = bytearray(b"%PDF-1.4\n")
    xref = [0]
    for index, obj in enumerate(objects, start=1):
        xref.append(len(output))
        output += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    startxref = len(output)
    output += f"xref\n0 {len(objects) + 1}\n".encode()
    output += b"0000000000 65535 f \n"
    for offset in xref[1:]:
        output += f"{offset:010d} 00000 n \n".encode()
    output += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF\n".encode()
    )
    return bytes(output)


chinese = root / "chinese.pdf"
chinese.write_bytes(build(objects))

reader = PdfReader(str(root / "plain.pdf"))
writer = PdfWriter()
writer.append(reader)
writer.encrypt("secret")
with (root / "encrypted.pdf").open("wb") as handle:
    writer.write(handle)

print("wrote", chinese.name, "encrypted.pdf")
