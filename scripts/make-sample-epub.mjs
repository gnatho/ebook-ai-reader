// Generates a readable, multi-chapter sample EPUB used as the reader's
// default book. Output is written to ./sample.epub and ./public/sample.epub.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const chapters = [
  {
    title: "Chapter One — The Arrival",
    body: [
      "The bus let me out at the bottom of the hill, where the road turned from tarmac to pale broken chalk. I had not expected the sea to be so close. It lay beyond a low wall of gorse, grey and busy, throwing a smell of salt and rust into the air. The driver wished me luck in a tone that suggested I would need it, and pulled away before I could ask which direction the lighthouse lay.",
      "I had a letter in my coat pocket, creased soft from a week of handling. It named me the new keeper of Cape Mire. It did not say what had become of the old one. There had been a short paragraph about duties, a shorter one about wages, and nothing at all about the house itself, though the house, when I finally raised my eyes to it, was the only remarkable thing on the headland.",
      "It stood three storeys high, whitewashed once and now the colour of old bone, with a square tower at its western shoulder. The tower's lamp was dark even in the failing light. A line of gulls traced slow circles above it, as if waiting for someone to switch it on.",
      "The walk up the hill was longer than it looked. By the time I reached the gate my calves ached and the wind had found every gap in my coat. The gate was unlocked but stiff, and the path beyond it was choked with last year's grass. Someone had been here, though. The brass of the door handle was bright. There were no footprints, but the wind would have swept them.",
      "I let myself in. The hall smelled of lamp oil and cold stone. A clock on the shelf had stopped at four minutes past three, and I could not tell if that was morning or evening, or from what year. I set my bag down and called out, more from habit than hope. Only the gulls answered, and they sounded annoyed.",
      "That first evening I did not go up the tower. I told myself it was because I was tired, and that the lamp could wait until I understood the rest of the house. In truth, the stairwell door at the end of the hall had a lock on it the size of my fist, and the lock was not on the outside.",
    ],
  },
  {
    title: "Chapter Two — The Locked Room",
    body: [
      "The house had been left as if its last occupant intended to return for tea. Cups sat upside down on a drying rack. A book lay face-down on a chair, its spine cracked at a page halfway through. I straightened it without thinking, then felt odd for doing so, as if I had interrupted a conversation.",
      "The kitchen was generous and cold, with a range that took me an hour to light. When the fire finally caught, it laughed at me through the grate, throwing heat that reached no further than my shins. I ate bread and tinned soup standing up, watching the window go from grey to black.",
      "It was the door at the end of the hall that would not leave me alone. By daylight it seemed ordinary enough: painted green, with a brass key turned in the lock. But the key did not turn, no matter how I coaxed it, and when I pressed my ear to the wood I thought I could hear the sea on the other side, which was impossible, because the sea was fifty yards away and down a cliff.",
      "I am not a superstitious man. I had taken this post precisely because I wanted quiet, and because the advertisement had promised quiet in capital letters. But houses remember their keepers, and this one had been kept for a long time by someone whose habits I did not know.",
      "On the second morning I found the book had moved. It was face-down again, but at a different page, nearer the end. I had not read it. I had not even noted the title. I noted it now: a slim volume on the habits of seabirds, with a name inscribed inside the cover in old ink. The name was not the one in my letter.",
      "I told myself a draft had moved it, that the house settled, that I was tired. Then I tried the green door again, and the key turned as easily as if someone had just oiled it from the inside.",
    ],
  },
  {
    title: "Chapter Three — The Tide",
    body: [
      "The room beyond the green door was not the tower stair I had expected. It was a small study, papered in a pattern of curling waves that had faded to the colour of weak tea. A desk stood beneath the window, and on the desk lay a logbook, open, its pages weighted with a smooth black stone.",
      "I should not have read it. A logbook belongs to the keeper, and I was the keeper now, and the man before me had not invited me in. But the door had opened itself, or nearly, and the room was warm where the rest of the house was cold, and so I sat down and began.",
      "The entries were short and practical for the first year. Weather, lamps trimmed, ships sighted. Then, around the month of March, the handwriting changed. It grew smaller, tighter, and the notes turned inward. There were observations about the tide that did not match the tide tables I had been sent. There were sketches in the margins of a shape beneath the water, drawn over and over until the pencil had nearly cut the page.",
      "I read until the light failed. When I looked up, the sea had come in. Where there had been a grey slope of rock below the window, there was now only black water, sliding against the cliff as if it wanted in. The lamp in the tower was still dark.",
      "I understood, then, one of my duties. I understood it the way you understand that a door has been left open behind you, not by seeing it but by the cold on the back of your neck. The lamp was not a comfort to ships. It was a warning. And it had not been lit in some time.",
      "I climbed the tower that night for the first time. The stairs were sound, the mechanism clean, the oil in its reservoir. Everything was ready. Everything had been waiting. I struck the lamp, and the headland woke around me in a slow turning circle of light, and out on the water, something turned with it.",
    ],
  },
  {
    title: "Chapter Four — Letters in the Dark",
    body: [
      "I kept the lamp lit for three nights running, and on each of those nights I saw the same shape roll at the edge of the beam. It was never quite where I looked. It moved the way a thought moves at the edge of sleep, present until you face it.",
      "On the fourth morning I went down to the shore at low tide. The rock pools were strange. There were shells there I did not know, spiralled tightly as if they had been wound by hand, and among them, wedged in a crack, a tin box the size of a fist, sealed with wax.",
      "Inside the box were letters, folded small and dry despite the sea. They were addressed to no one, and signed only with a single initial. They spoke of the lamp as if it were a kindness, and of the dark beyond it as if the dark were a country with its own customs and its own hunger.",
      "I did not know what to make of them. I am not a poet, and the letters read like poetry, or like the kind of thing a lonely keeper writes to the thing he fears, to make it familiar. I folded them away and climbed back up to the house, and I did not light the lamp that night.",
      "The house was different in the morning. Not moved, not rearranged, but attentive, the way a room goes quiet when someone is listening at the keyhole. The logbook lay open on the desk, though I had closed it. The page it showed me was the last one, and the last entry was a single line in that tight, small hand: He will know when to stop. Do not let him stop.",
      "I sat with that line for a long time. Outside, the gulls had gone elsewhere. The sea had drawn back, farther than I had seen it go, and the rock it uncovered was not rock at all but something older, ribbed and dark, breathing slowly in the sun.",
    ],
  },
  {
    title: "Chapter Five — The Keeper's Confession",
    body: [
      "I will set down plainly what I came to understand, because understanding is the only lamp that does not need oil. The keeper before me had not vanished. He had stayed, too long, and the line between the watcher and the watched had worn thin, the way a rope wears where it runs over stone.",
      "He had loved the dark, in the end. Not the absence of light, but the thing that lives in the absence of light, which is patient and which learns the shape of whoever keeps it company. The lamp had been his defense against it, and then his greeting, and then, I think, his apology.",
      "Reading the letters again, I saw that he had tried to stop. The first letter is almost cheerful. The last is barely a letter at all, only a drawing of the shape beneath the water, and beneath the drawing, the words: It knows my name now. Yours will do as well.",
      "I burned the letters. I tell myself it was the right thing. Fire is honest; it does not keep what it is given. The wax from the tin smeared on the grate, and the smoke smelled of salt and something older than salt, and for a moment the fire burned green at the edges before it settled back to orange.",
      "That night I lit the lamp again, and I resolved to keep it lit, and to keep my reading of the logbook to the daylight hours. A keeper's first duty is to the lamp. A keeper's second duty, which is not written anywhere, is to remain a keeper, and not to become a part of what he watches.",
      "Whether I will succeed I do not know. The house is quiet now, and the green door stays shut, and the book of seabirds has not moved from its shelf. But the sea is very close tonight, closer than the maps would allow, and it has begun to whisper my name in a voice that is almost, but not quite, my own.",
    ],
  },
  {
    title: "Chapter Six — Dawn",
    body: [
      "Morning came the way morning comes at the edge of the world, all at once and without warning. The lamp grew pale against the sky and I let it rest, and I went down to the kitchen and made tea, and I did not look at the window until the kettle had whistled and gone quiet.",
      "The sea had gone back to its proper distance. The rock, if rock it was, had sunk beneath the water again, and the gulls had returned to their circles above the tower. It would have been easy, then, to call the night a fancy, to blame the bread and the cold and the strange handwriting of a man I had never met.",
      "I did not. I had read the letters, and I had seen the green fire, and I had heard my name spoken in a voice that was not my own. These are not the kinds of things a man forgets, however convenient forgetting would be.",
      "I made a new entry in the logbook, in my own hand. I wrote the date and the weather and the state of the lamp, as keepers have done here for a hundred years. Then, at the bottom, I added a line for the next keeper, whenever he comes: The lamp is a warning, not a welcome. Keep it lit. Do not write to the dark, and do not answer when it writes to you.",
      "I closed the book and weighted it with the black stone and went out into the daylight to walk the headland. The wind had turned fair. Far out on the water a fishing boat moved, small and steady and sure of itself, and I raised a hand to it though it was too far to see.",
      "There is work to do here, and quiet, and a kind of company I had not expected. The house has settled now that someone is keeping it, and the green door has not opened again on its own. I think it will be a good posting. I think, if I am careful, I may even grow to love it, as he did, before the loving went wrong.",
    ],
  },
];

const chapterItems = chapters.map((c, i) => {
  const id = `chap${i + 1}`;
  const href = `${id}.xhtml`;
  const paragraphs = c.body.map((p) => `<p>${p}</p>`).join("\n");
  return {
    id,
    href,
    title: c.title,
    html: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${c.title}</title></head>
<body>
<h1>${c.title}</h1>
${paragraphs}
</body>
</html>`,
  };
});

const manifest = chapterItems
  .map((c) => `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
  .join("\n");

const spine = chapterItems.map((c) => `    <itemref idref="${c.id}"/>`).join("\n");

const navItems = chapterItems
  .map((c) => `      <li><a href="${c.href}">${c.title}</a></li>`)
  .join("\n");

const ncxPoints = chapterItems
  .map(
    (c, i) =>
      `    <navPoint id="${c.id}" playOrder="${i + 1}"><navLabel><text>${c.title}</text></navLabel><content src="${c.href}"/></navPoint>`
  )
  .join("\n");

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
    <dc:title>The Keeper of Cape Mire</dc:title>
    <dc:creator>Sample Press</dc:creator>
    <dc:identifier id="bookid">urn:uuid:cape-mire-sample</dc:identifier>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-07-05T00:00:00Z</meta>
  </metadata>
  <manifest>
${manifest}
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`
);

for (const c of chapterItems) {
  zip.file(`OEBPS/${c.href}`, c.html);
}

zip.file(
  "OEBPS/nav.xhtml",
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body>
<nav epub:type="toc">
<h1>Contents</h1>
<ol>
${navItems}
</ol>
</nav>
</body>
</html>`
);

zip.file(
  "OEBPS/toc.ncx",
  `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`
);

const buf = await zip.generateAsync({
  type: "nodebuffer",
  mimeType: "application/epub+zip",
});

const outRoot = path.join(projectRoot, "sample.epub");
const outPublic = path.join(projectRoot, "public", "sample.epub");
fs.writeFileSync(outRoot, buf);
fs.writeFileSync(outPublic, buf);

const reread = await JSZip.loadAsync(buf);
console.log(
  "wrote sample.epub",
  buf.length,
  "bytes; entries:",
  Object.keys(reread.files).length
);
