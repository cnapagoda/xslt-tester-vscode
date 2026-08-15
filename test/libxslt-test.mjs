import { XmlDocument, XsltStylesheet } from 'libxslt-wasm';
import { readFileSync } from 'fs';

const xml = readFileSync('test/books.xml', 'utf8');
const xsl = readFileSync('test/list-1.0.xsl', 'utf8');

const doc = await XmlDocument.fromString(xml);
const sheet = await XsltStylesheet.fromString(xsl);
const result = await sheet.apply(doc);
console.log(sheet.applyToString ? sheet.applyToString(doc) : result.toString());
sheet.delete(); doc.delete();
