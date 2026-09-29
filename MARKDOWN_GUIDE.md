# Koka Notes Markdown Formatting Guide

Koka supports rich GitHub Flavored Markdown (GFM) along with extended formatting helpers in your personal anime and manga notes.

Whether you are writing review summaries, episode logs, reading reactions, or hiding plot spoilers, this guide shows all supported formatting styles and examples.

---

## Quick Reference Table

| Style | Syntax | Example |
| :--- | :--- | :--- |
| **Bold** | `**text**` or `** text **` | **Favorite Episode** |
| *Italic* | `*text*` or `_text_` | *Masterpiece* |
| ***Bold & Italic*** | `***text***` or `*** text ***` | ***Must Watch*** |
| ~~Strikethrough~~ | `~~text~~` | ~~Dropped~~ Rewatched |
| `Code` | `` `text` `` | `Chapter 145` |
| **Spoilers / Collapsible** | `<details><summary>Title</summary>Content</details>` | Collapsible spoiler card with `>` arrow |
| **Line Breaks** | `<br>` or `<br/>` | Hard line break within paragraph |
| **Extra Spacing** | Multiple blank lines or `<br><br>` | Preserved blank vertical gaps |
| **Task / Checklist** | `- [ ]` or `- [x]` | Checkboxes for episodes/arcs |
| **Quotes** | `> quote` | Accent-bordered quote block |

---

## Editor Toolbar & One-Click Formatting

The notes editor includes a rich toolbar directly above your note for one-click formatting:

- **Text Styling**: **Bold** (`**`), *Italic* (`_`), ***Bold & Italic*** (`***`), ~~Strikethrough~~ (`~~`), and `Inline Code` (`` ` ``).
- **Headings**: H1 (`#`), H2 (`##`), H3 (`###`).
- **Lists & Checklists**: Bullet list (`-`), numbered list (`1.`), and task checklist (`- [ ]`).
- **Blocks**: Blockquotes (`>`), multi-line code blocks (`` ``` ``), markdown table template, horizontal dividers (`---`), and line breaks (`<br>`).
- **Interactive Tools**: 
  - **Link**: Insert clickable markdown links (`[title](url)`).
  - **Spoiler / Summary (`<details><summary>`)**: Wraps selected text or inserts a collapsible spoiler block with a clickable summary header and rotating chevron arrow.

Clicking any toolbar button while in Preview mode automatically switches to Edit mode and inserts the formatting at your cursor.

---

## 1. Text Formatting & Emphasis

You can emphasize key notes, titles, or rankings using asterisks, underscores, or tildes. Loose spaces inside formatting tags are also automatically supported.

```markdown
**Bold text** or ** text with inner spaces **
*Italic text* or _italic text_
***Bold and italic*** or *** text with inner spaces ***
~~Strikethrough text~~
```

---

## 2. Spoilers & Collapsible Sections (`<details>` & `<summary>`)

Hide sensitive plot twists, endings, or long episode summaries using native HTML disclosure tags. Koka renders these with a clean card container and a rotating chevron arrow (`>`):

```html
<details>
<summary>⚠️ Major Plot Spoiler - Season 2 Ending</summary>

Here are the hidden details about the final battle and who survived...
You can also use formatting inside:
- **Major twist**: Character revealed
- *Status*: Ended
</details>
```

> **Tip:** You can have multiple `<details>` blocks in a single note to organize thoughts by season or volume!

---

## 3. Line Breaks & Vertical Spacing

Koka preserves intentional spacing in your notes:

- **Soft line breaks / Hard breaks**: Put `<br>` or `<br/>` or leave two spaces at the end of a line.
- **Multiple blank lines**: If you press Enter multiple times to create a visual gap between sections, Koka preserves those vertical gaps instead of collapsing them into a single line.
- **Double break**: Use `<br><br>` to force an empty line break without starting a new heading.

```markdown
Section 1: General Thoughts
<br><br>
Section 2: Character Analysis (with preserved space above)
```

---

## 4. Headings

Organize long notes into sections using `#`:

```markdown
# Heading 1 (Arc Title)
## Heading 2 (Season 1)
### Heading 3 (Episode Review)
#### Heading 4
```

---

## 5. Lists & Progress Checklists

Track episodes, movies, or reading goals:

### Task Lists (Checkboxes)
```markdown
- [x] Season 1 (Episodes 1–12)
- [x] Mugen Train Movie
- [ ] Season 2 (Entertainment District Arc)
- [ ] Season 3 (Swordsmith Village Arc)
```

### Bullet & Numbered Lists
```markdown
- Favorite characters:
  * Anya Forger
  * Loid Forger
  * Yor Forger

1. First watch: Summer 2024
2. Rewatch: Winter 2025
```

---

## 6. Quotes & Dialogue

Highlight iconic lines or memorable quotes:

```markdown
> "Whatever you do, enjoy it to the fullest. That is the secret of life."
> — *Rider (Fate/Zero)*
```

---

## 7. Links & Images

Add links to AniList, MAL, wiki pages, or OST playlists:

```markdown
[Listen to Opening Theme on YouTube](https://youtube.com)
[AniList Entry](https://anilist.co)
```

> Note: All external links open securely in a new tab (`target="_blank" rel="noopener noreferrer"`).

---

## 8. Tables

Organize volume progress, ratings, or watch dates:

```markdown
| Season | Score | Status |
| :--- | :---: | :--- |
| Season 1 | 9/10 | Completed |
| Season 2 | 8.5/10 | Completed |
| OVA | 7/10 | Watched |
```

---

## 9. Code Blocks

Useful for chapter tracking templates or formatted data:

```markdown
```text
Reading order:
Vol 1 -> Vol 3 -> Side Story A -> Vol 4
```
```

---

## Example Note

Here is a full real-world note combining these tools:

```markdown
### 🌸 Frieren: Beyond Journey's End

**Rating**: ***10 / 10***
**Favorite Arc**: *First-Class Mage Exam*

- [x] Season 1 completed (Episodes 1–28)
- [ ] Read manga starting from Chapter 61

> "The journey doesn't end when the adventure is over."

<details>
<summary>🔍 Thoughts on Himmel & Frieren's Relationship</summary>

The flashbacks in Episode 14 and Episode 28 highlight how Himmel's actions subtly guided Frieren's entire path...
</details>

<br>

*Last updated: September 2026*
```
