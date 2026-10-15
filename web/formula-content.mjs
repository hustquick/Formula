// Content contract only: document identity/lifecycle and undo ownership live elsewhere.
const languages = ['latex', 'typst'];
const clone = value => JSON.parse(JSON.stringify(value));
export class FormulaContent {
  constructor(saved, {language = 'latex', text = '', origin = 'legacy'} = {}) {
    this.revision = 0;
    this.authority = {language, text, origin};
    this.representations = {};
    this.conversions = {};
    this.validation = 'pending';
    // A persisted representation is reusable only for its exact active text/version.
    if (saved?.schemaVersion === 1 && Number.isSafeInteger(saved.revision) && saved.revision >= 0 &&
        languages.includes(saved.authority?.language) && typeof saved.authority.text === 'string' &&
        saved.representations?.[language]?.text === text && saved.representations[language].revision === saved.revision &&
        saved.representations?.[saved.authority.language]?.text === saved.authority.text &&
        saved.representations[saved.authority.language].revision === saved.revision) {
      this.revision = saved.revision;
      this.authority = clone(saved.authority);
      for (const lang of languages) {
        const rep = saved.representations[lang];
        if (rep?.revision === this.revision && typeof rep.text === 'string' && rep.sourceLanguage === this.authority.language) this.representations[lang] = clone(rep);
      }
      this.conversions = clone(saved.conversions || {});
      this.validation = saved.validation === 'parsed' ? 'parsed' : 'pending';
    } else this.representations[language] = this.original(language, text);
  }
  original(language, text) { return {text, revision:this.revision, sourceLanguage:language, kind:'original', fidelity:'exact'}; }
  get(language) {
    const rep = this.representations[language];
    return rep?.revision === this.revision ? rep : null;
  }
  matches(language, text) { return this.get(language)?.text === text; }
  edit(language, text, origin = 'source') {
    if (!languages.includes(language) || typeof text !== 'string') throw Error('Invalid formula representation');
    if (this.matches(language, text)) return false;
    this.revision++;
    this.authority = {language, text, origin};
    this.representations = {[language]:this.original(language, text)};
    this.conversions = {};
    this.validation = 'pending';
    return true;
  }
  derive(language, text, converter) {
    if (typeof text !== 'string') throw Error('Converter did not return source text');
    if (!this.get(language)) this.representations[language] = {text, revision:this.revision, sourceLanguage:this.authority.language, kind:'derived', fidelity:'unverified', converter};
    this.conversions[language] = {status:'available', revision:this.revision, fidelity:this.get(language).fidelity};
    return this.get(language).text;
  }
  resolve(language, convert) {
    if (!languages.includes(language)) throw Error('Invalid formula language');
    const cached = this.get(language);
    if (cached) return cached.text;
    try { return this.derive(language, convert(this.authority), 'tex2typst@0.6.2'); }
    catch (error) {
      this.conversions[language] = {status:'unsupported', revision:this.revision, message:String(error.message || error)};
      throw error;
    }
  }
  parsed(latex) {
    this.derive('latex', latex, 'tex2typst@0.6.2');
    this.validation = 'parsed';
  }
  serialize() { return clone({schemaVersion:1, revision:this.revision, authority:this.authority, representations:this.representations, conversions:this.conversions, validation:this.validation}); }
}
