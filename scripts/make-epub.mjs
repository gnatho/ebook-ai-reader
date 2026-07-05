// Generates a minimal valid EPUB for testing the reader.
import fs from "fs";
import JSZip from "jszip";

const paragraphs = Array.from({ length: 40 }, (_, i) =>
  `<p>Paragraph ${i + 1}. The quick brown fox jumps over the lazy dog. This is sentence number ${i + 1} of a generated sample chapter used to verify pagination in the ebook reader.</p>`
).join("\n");

const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

zip.file(
  "META-INF/container.xml",
  `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
);

zip.file(
  "OEBPS/content.opf",
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Sample Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:identifier id="bookid">urn:uuid:test-1234</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chap1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chap1"/>
  </spine>
</package>`
);

zip.file(
  "OEBPS/chapter1.xhtml",
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
<h1>Chapter One</h1>
${paragraphs}
</body>
</html>`
);

zip.file(
  "OEBPS/nav.xhtml",
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">Chapter 1</a></li></ol></nav></body>
</html>`
);

zip.file(
  "OEBPS/toc.ncx",
  `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap><navPoint id="c1"><navLabel><text>Chapter 1</text></navLabel><content src="chapter1.xhtml"/></navPoint></navMap>
</ncx>`
);

const buf = await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
fs.writeFileSync("scripts/valid.epub", buf);

const reread = await JSZip.loadAsync(buf);
console.log("wrote scripts/valid.epub", buf.length, "bytes; entries:", Object.keys(reread.files).length);
