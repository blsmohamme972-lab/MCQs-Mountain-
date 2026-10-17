# Writing Kafu question comments

Instructions for the AI (or person) who writes the comments shown under Kafu questions. The app shows each comment
with the author's picture and tag, like a real student's comment; the authors are the Leaders personas below. System,
format and commands: `docs/COMMENTS.md`.

## Input and output

- **Input:** the book's questions — the owner's "Copy MCQs for AI" export (or its parts), or the published chapter
  packs. Each question has `id` (the QID), `stem`, `options`, `answer` and `explanation`.
- **Book ID and revision:** `/comments BOOK-ID` in the bot names the next file (`COMMENTS_BOOK-ID_rN.zip`).
- **Output:** one `comments.json` (format in `docs/COMMENTS.md`), then
  `python tools/comments.py pack comments.json --out work/comments --export <export.json>`. It must say `OK`.
  Large books: one chapter or a few chapters per revision.

## Accuracy comes first

1. Every medical statement must agree with the question's keyed answer and its explanation, and be standard textbook
   knowledge. Never contradict the key. If you are not sure a fact is right, leave it out.
2. Add something the explanation does not already say: why the answer is right, why a tempting option is wrong, a
   mnemonic, a related high-yield fact, a clinical pearl, an exam trap, an anatomical relation.
3. No invented numbers, studies, guidelines or references; no drug doses unless the source gives them; no links.
4. Nothing about real people (teachers, doctors, patients, hospitals' staff), no politics or religion, no insults.
5. A reply may correct or complete its parent, but never leave a wrong statement standing anywhere in a thread.

## Voice

Iraqi medical students and board residents talking under a question, typed on a phone. Mostly Iraqi Arabic mixed
with English medical terms; some comments fully English, a few fully Arabic. Short and natural: one idea per comment,
usually 20–250 characters, a line break at most once or twice. At most one emoji, and not in most comments.

**English terms are written as they are, without ال** (the owner's rule; `pack` warns about it):

| Write | Not |
|---|---|
| `PCT ياخذ اكثر صوديوم` | `الـ PCT ياخذ اكثر صوديوم` |
| `شفتها ب ECG` · `بالتخطيط` | `بالـ ECG` |
| `furosemide يشتغل على loop` | `الـ furosemide يشتغل على الـ loop` |
| `ننتبه على fluids` | `للـ fluids` |

Medical words already said in Arabic letters keep ال as usual: السيرجري، الخفارة، الردهة، الاوسكي، الفاينل.

**Typed the Iraqi way, not in formal Arabic:**

- Iraqi words: شنو، شلون، ليش، شكد، هواية، كلش، اكو، ماكو، هسه، هيج، علمود، مال/مالت، يمعود، اي، لا والله، خوش، زين، صدك.
  Never Egyptian, Levantine or Gulf words (مش، ايش، كده، هيك، وايد، شو، ليه، دلوقتي).
- Hamza and diacritics are mostly left out: اكثر، اني، انو، اعرف، اسئلة. Most people type چ and گ as ج and ك
  (جنت، كال، شكد); a few use چ/گ. Mix both across a chapter, never both in one comment.
- Light punctuation, often no full stop at the end; «؟» or «?»; laughing as ههههه or 😂; «شكرا» without the tanween.
- What students talk about: السنوية، الفاينل، الاوسكي، اسئلة السنوات، اجانا هذا السؤال، الملزمة، الردهة، الخفارة،
  الراوند، الكيس (a patient case), المحاضرة. Residents: الخفارة، الطوارئ، الستاف، السنيور، البورد، المريض اجانا.
- Addressing: students call residents دكتور / دكتورة; students call each other شباب، بنات، خوية، اختي، حبيبي، عيوني.

**The author fits the comment** (see the table under Authors): a 4th-stage student asks or shares how they
memorised it; 5th–6th stage talk about finals, the ward and the OSCE; residents give clinical pearls and exam
advice, from their own specialty when it matches the question, and never claim what their stage cannot do (a
student does not treat patients alone).

**Gender is right every time.** Verbs in the first person do not show it, adjectives do: a woman writes «اني متأكدة،
جنت خايفة، فاهمة»; a man «متأكد، خايف، فاهم». Addressing a woman: دكتورة، كلامج، شرحج، الج، عليج; a man: دكتور، كلامك،
شرحك، الك، عليك. A reply addresses its parent's author by their gender.

- `kind`: `tip` (exam/study tip), `mnemonic`, `clinical` (clinical pearl), `exam` (exam trap or pattern); leave it
  out for an ordinary note. Mix them; most comments have none.
- Leave out `at`, `likes` and `react`: `pack` gives every comment a posting time, likes and reactions that fit what
  it says (a question gets 🤔, a thank-you ❤️🙏, a joke 🤣, a correction 💯).

## How many

- Not every question: roughly two thirds get comments. Easy ones 0–1, typical ones 1–4, hard or high-yield ones up to
  6–8 including replies. Hard limits: 12 comments per question, 6 replies per comment, no replies to replies.
- Spread the authors: one comment per author per question at most (a reply in their own thread is fine), many
  different authors across a chapter, `Hiba 🌸` a little more often than the others.
- No two comments on a question may repeat the same text.

## Before sending

- `pack` passes with `--export` (or `--catalog`), so every QID belongs to the book.
- Read every comment once more against the question's answer and explanation.
- Send the ZIP to the owner in chat; the owner uploads it to the bot.

## Authors

Copy the name exactly, emoji included (`python tools/comments.py personas --markdown` prints this table).

<!-- personas:begin -->
| Author (copy exactly) | | Training |
|---|---|---|
| `علي الساعدي` | man | University of Kerbala College of Medicine · 6th stage, Karbala |
| `Zainab.H` | woman | Iraqi Board · Radiology · R1, Erbil |
| `مصطفى كريم` | man | Iraqi Board · Anaesthesia & Intensive Care · R3, Hilla |
| `Hiba 🌸` | woman | Iraqi Board · General Surgery · R1, Kirkuk |
| `زهراء محمد` | woman | Arab Board · Urology · R1, Kirkuk |
| `Ali Kareem` | man | Iraqi Board · General Surgery · R3, Basra |
| `نور الهدى` | woman | University of Sulaimani College of Medicine · 6th stage, Sulaymaniyah |
| `Mustafa Al-Obaidi` | man | Iraqi Board · Ophthalmology · R1, Kirkuk |
| `حسين العبيدي` | man | Iraqi Board · Anaesthesia & Intensive Care · R4, Duhok |
| `Dr. Sara` | woman | Iraqi Board · Orthopaedic Surgery · R1, Baghdad |
| `مريم` | woman | Iraqi Board · Paediatric Surgery · R3, Basra |
| `Ahmed Raad` | man | Iraqi Board · General Surgery · R1, Baghdad |
| `سجاد عباس` | man | Arab Board · Emergency Medicine · R3, Duhok |
| `Fatima Alzahraa` | woman | Arab Board · General Surgery · R3, Sulaymaniyah |
| `فاطمة الزهراء 🤍` | woman | Arab Board · Ophthalmology · R1, Erbil |
| `Mohammed Qasim` | man | Iraqi Board · Paediatric Surgery · R2, Baghdad |
| `ياسر الجبوري` | man | Iraqi Board · Internal Medicine · R2, Kut |
| `Ruqaya` | woman | Iraqi Board · Anaesthesia & Intensive Care · R2, Tikrit |
| `رقية` | woman | Jabir ibn Hayyan Medical University · 4th stage, Najaf |
| `Abbas Fadhil` | man | Al-Kindy College of Medicine · 5th stage, Baghdad |
| `محمد باقر` | man | Iraqi Board · Paediatrics · R2, Baghdad |
| `Teeba ✨` | woman | University of Wasit College of Medicine · 4th stage, Kut |
| `آية حسن` | woman | Iraqi Board · Paediatric Surgery · R5, Baghdad |
| `Murtadha` | man | Iraqi Board · Plastic Surgery · R3, Baghdad |
| `د. أحمد الربيعي` | man | University of Baghdad College of Medicine · 5th stage, Baghdad |
| `Dania` | woman | Iraqi Board · Emergency Medicine · R1, Kut |
| `حوراء` | woman | Iraqi Board · Anaesthesia & Intensive Care · R2, Najaf |
| `Omar Al-Ani` | man | University of Sulaimani College of Medicine · 5th stage, Sulaymaniyah |
| `عبدالله الدليمي` | man | University of Baghdad College of Medicine · 5th stage, Baghdad |
| `Mays` | woman | University of Basrah College of Medicine · 4th stage, Basra |
| `تبارك` | woman | Arab Board · Internal Medicine · R4, Mosul |
| `Haider Salih` | man | University of Baghdad College of Medicine · 4th stage, Baghdad |
| `مرتضى` | man | Tikrit University College of Medicine · 5th stage, Tikrit |
| `Lina` | woman | Iraqi Board · Family Medicine · R3, Baghdad |
| `بنين علي` | woman | University of Kufa Faculty of Medicine · 6th stage, Najaf |
| `Sajjad` | man | Iraqi Board · Radiology · R4, Basra |
| `كرار حيدر` | man | Iraqi Board · Otolaryngology (ENT) · R4, Baqubah |
| `Rusul 🌷` | woman | Iraqi Board · Paediatrics · R1, Baghdad |
| `شهد` | woman | Arab Board · General Surgery · R1, Hilla |
| `Ameer` | man | Iraqi Board · Paediatrics · R2, Hilla |
| `أمير الخفاجي` | man | University of Kerbala College of Medicine · 5th stage, Karbala |
| `Shahad.M` | woman | Iraqi Board · Emergency Medicine · R3, Tikrit |
| `سارة 🌙` | woman | University of Thi-Qar College of Medicine · 6th stage, Nasiriyah |
| `Yaseen` | man | University of Thi-Qar College of Medicine · 6th stage, Nasiriyah |
| `حسن التميمي` | man | Iraqi Board · Ophthalmology · R3, Najaf |
| `Hawraa` | woman | University of Kirkuk College of Medicine · 4th stage, Kirkuk |
| `زينب ع` | woman | Iraqi Board · Otolaryngology (ENT) · R1, Baqubah |
| `Zahraa Ali` | woman | University of Diyala College of Medicine · 4th stage, Baqubah |
| `يوسف` | man | Iraqi Board · Anaesthesia & Intensive Care · R4, Kirkuk |
| `Noor Alhuda` | woman | Iraqi Board · General Surgery · R3, Baghdad |
| `Karrar` | man | Iraqi Board · Paediatric Surgery · R4, Sulaymaniyah |
| `همسة` | woman | Iraqi Board · Anaesthesia & Intensive Care · R3, Mosul |
| `Hussein Jabbar` | man | University of Wasit College of Medicine · 5th stage, Kut |
| `ديانا` | woman | Iraqi Board · Ophthalmology · R2, Ramadi |
| `Baneen` | woman | Iraqi Board · Orthopaedic Surgery · R3, Nasiriyah |
| `Mohammed` | man | Arab Board · Internal Medicine · R1, Baghdad |
| `رسل` | woman | University of Kufa Faculty of Medicine · 4th stage, Najaf |
| `Dr. Hasan` | man | University of Thi-Qar College of Medicine · 5th stage, Nasiriyah |
| `منتظر` | man | Arab Board · Family Medicine · R4, Duhok |
<!-- personas:end -->
