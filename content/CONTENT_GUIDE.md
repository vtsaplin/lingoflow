# Content Creation Guide

This guide describes the format and structure of content for the German language learning application.

## Directory Structure

Content is organized by language proficiency levels:

```
content/
├── a2/          # A2 Level
├── b1/          # B1 Level (future)
├── b2/          # B2 Level (future)
└── CONTENT_GUIDE.md
```

## File Format

### File Naming Convention

Files should be named following this pattern:
```
NN-theme_name.md
```

Where:
- `NN` - two-digit topic number (01, 02, 03...)
- `theme_name` - theme name in German, words separated by underscores
- Extension `.md` (Markdown)

**Examples:**
- `01-wohn_umgebung.md`
- `05-behoerden.md`
- `11-weiterbildung.md`

### File Content Structure

Each content file should follow a unified structure:

```markdown
# [Topic Title]

## [Subtopic 1]

[Paragraph 1 text]

[Paragraph 2 text]

## [Subtopic 2]

[Paragraph 1 text]

[Paragraph 2 text]

...
```

#### Formatting Rules:

1. **First-level heading (H1)**: Topic title in German
   - Used only once at the beginning of the file
   - Example: `# Weiterbildung`

2. **Second-level headings (H2)**: Subtopics/scenarios
   - Describe specific situations or aspects of the topic
   - Examples: `## Deutschkurs besuchen`, `## Die Wohnung ist zu laut`

3. **Paragraphs**: Main text
   - Each paragraph is separated by a blank line
   - Text should be natural and practical
   - Use everyday situations and dialogues

4. **Number of subtopics**: Recommended 4-6 subtopics per file

## Content Requirements

### Language Level

For **A2** level:
- Simple, short sentences (5-15 words)
- Basic grammar: present tense, past (Perfekt), future (möchte)
- Everyday vocabulary
- Personal pronouns and polite forms of address

### Topics and Context

Content should be:
- **Practical**: real-life situations
- **Relevant**: everyday needs of language learners
- **Diverse**: different text types (description, dialogue, letter)

### Examples of Life Situations:

- Communication with neighbors and landlord
- Going to the doctor or pharmacy
- Job search and interview
- Communication with government agencies
- Shopping at stores
- Using public transportation
- Planning leisure activities
- Education and courses

## Text Examples

### Situation Description
```markdown
## Die Wohnung putzen

Meine Wohnung ist nicht sauber. Ich muss heute putzen. Zuerst putze ich das Badezimmer. Dann sauge ich den Boden im Wohnzimmer und im Schlafzimmer.

In der Küche muss ich den Tisch und den Herd sauber machen. Das Putzen dauert ungefähr zwei Stunden. Dann ist alles wieder ordentlich.
```

### Dialogue/Letter
```markdown
## Ein Zimmer mieten

Guten Tag, ich heiße Maria. Ich suche ein Zimmer in Zürich. Ich arbeite hier und brauche ein Zimmer ab dem ersten März.

Das Zimmer soll nicht zu teuer sein. Ich kann maximal 800 Franken pro Monat bezahlen. Haben Sie ein Zimmer frei? Kann ich das Zimmer ansehen?
```

### First-Person Narrative
```markdown
## Computerkurs für Anfänger

Ich kann nicht gut mit dem Computer arbeiten. Das ist ein Problem. Viele Jobs brauchen heute Computerkenntnisse. Ich melde mich für einen Kurs an.

Im Kurs lerne ich, wie man E-Mails schreibt. Ich lerne auch Word und Excel. Der Kurs dauert sechs Wochen. Am Ende bekomme ich ein Zertifikat. Das hilft mir bei der Arbeitssuche.
```

## Checklist for Creating a New File

- [ ] File has the correct name: `NN-theme_name.md`
- [ ] File is located in the correct level directory (e.g., `content/a2/`)
- [ ] Has one H1 heading with the topic title
- [ ] Has 4-6 H2 headings with subtopics
- [ ] Each subtopic contains 1-3 paragraphs
- [ ] Uses appropriate language level (A2, B1, etc.)
- [ ] Texts describe practical life situations
- [ ] Markdown formatting is observed (blank lines between elements)
- [ ] Texts are diverse by type (description, dialogue, letter, etc.)

## Adding a New Level

To add a new level (e.g., B1):

1. Create directory `content/b1/`
2. Follow the same file naming rules
3. Adapt text complexity to B1 level:
   - Longer sentences
   - More complex grammar (Konjunktiv, Passiv)
   - Extended vocabulary
   - More abstract topics

## List of Topics for A2

Recommended topics for A2 level:

1. Wohnumgebung (Housing and environment)
2. Kinder (Children)
3. Arbeit (Work)
4. Arbeitssuche (Job search)
5. Behörden (Government agencies)
6. Medien und Freizeit (Media and leisure)
7. Verkehr (Transportation)
8. Einkäufe (Shopping)
9. Post, Bank, Versicherungen (Post, bank, insurance)
10. Gesundheit (Health)
11. Weiterbildung (Further education)

## Writing Tips

1. **Use specific details**: prices, dates, addresses make the text realistic
2. **Include emotions and opinions**: "Ich bin nervös", "Das ist ein Problem"
3. **Use modal verbs**: können, müssen, möchte, sollen
4. **Vary tenses**: Präsens, Perfekt, Futur mit werden/möchte
5. **Show processes**: "Zuerst... dann... danach..."
6. **Include questions**: make the text more interactive

## Questions?

If you have questions about creating content, refer to existing files in `content/a2/` as examples.
