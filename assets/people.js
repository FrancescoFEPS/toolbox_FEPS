/* Shared helpers to read people (name, last name, organisation) from a table. Needs table.js first. */
"use strict";
/* Small words that belong to a surname: "Ursula von der Leyen" -> last name "von der Leyen". */
const PARTICLES = new Set(["von", "van", "der", "den", "de", "del", "della", "di", "da", "du", "des", "le", "la", "el", "al", "bin", "ter", "ten", "dos", "das", "do", "zu", "af", "av"]);
/* "Andreas SCHIEDER", "Ania Skrzypek", "Skrzypek, Ania" -> { first, last } */
function splitName(s) {
  s = clean(s);
  if (!s) return { first: "", last: "" };
  if (s.includes(",")) { const [a, ...b] = s.split(","); if (b.join(",").trim()) return { first: clean(b.join(" ")), last: clean(a) }; }
  const w = s.split(" ");
  if (w.length < 2) return { first: w[0], last: "" };
  let i = w.findIndex(x => x.length > 1 && x === x.toUpperCase() && x !== x.toLowerCase());   // surname written in capitals
  if (i <= 0) {
    i = w.length - 1;
    while (i > 1 && PARTICLES.has(w[i - 1].toLowerCase())) i--;   // keep "von", "de la"... with the surname (never swallow the first name)
  }
  return { first: w.slice(0, i).join(" "), last: w.slice(i).join(" ") };
}
/* Finds the columns by title. Works with: Name + Last name; one column holding the full name;
   "Organisation", "Organisation / Job title", "Company"... (organisation left blank if no such column). */
function readPeople(rows) {
  const hdr = (rows[0] || []).map(norm);
  const eq = names => hdr.findIndex(h => names.includes(h));
  const part = (inc, exc = []) => hdr.findIndex(h => h && inc.some(w => h.includes(w)) && !exc.some(w => h.includes(w)));
  let last = eq(["lastname", "surname", "familyname", "nom"]);
  if (last < 0) last = part(["lastname", "surname", "familyname"]);
  let first = eq(["firstname", "name", "givenname", "forename", "prenom"]);
  if (first < 0) first = part(["firstname", "givenname"]);
  if (first < 0) first = eq(["fullname", "participant", "participantname", "nameandsurname", "nameandlastname"]);
  if (first < 0) first = part(["name"], ["organi", "company", "event", "job", "title", "institution", "last", "sur", "family", "file"]);
  if (first < 0) throw new Error("Couldn't find a “Name” column (or a column with the full name) on the first row of the file.");
  let org = eq(["organisation", "organization", "company", "institution", "employer", "affiliation"]);
  if (org < 0) org = part(["organi", "company", "institution", "affiliation", "employer"]);
  const ev = eq(["event", "eventname"]);
  const people = rows.slice(1).map(r => {
    let f = clean(r[first]), l = last >= 0 ? clean(r[last]) : "";
    if (!l && f.includes(" ") || last < 0) ({ first: f, last: l } = splitName(f));
    return { first: f, last: l, org: org >= 0 ? clean(r[org]) : "", event: ev >= 0 ? clean(r[ev]) : "" };
  }).filter(p => p.first || p.last);
  return { people, event: (people.find(p => p.event) || {}).event || "" };
}
