# LingoFlow

## Overview

LingoFlow is a single-user web application for personal language learning through reading and listening. The app focuses on German texts with pronunciation, translation, and dictionary explanations. Users can read topic-based texts, click on words or sentences for translations and definitions, and listen to text-to-speech audio. The application also provides a podcast RSS feed for listening to learning texts in podcast apps.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration and CSS variables for theming

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Structure**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Content System**: Markdown files parsed at runtime from `/content` directory
- **Build System**: Custom build script using esbuild for server and Vite for client

### Content Management
- Content stored as Markdown files in `/content/a2/` directory
- Each file represents one topic with multiple learning texts
- File format: H1 for topic title, H2 for individual text sections
- No database required for content - parsed directly from filesystem

### API Endpoints
- `GET /api/topics` - List all topics with their texts
- `GET /api/topics/:id` - Get single topic by ID
- `POST /api/tts` - Text-to-speech synthesis
- `POST /api/translate` - Text translation
- `POST /api/dictionary` - Word dictionary lookup
- `GET /podcast/feed.xml` - RSS podcast feed
- `GET /podcast/audio/:topicId/:textId.mp3` - Episode audio with caching
- `POST /api/download-combined-mp3` - Batch download selected texts as single MP3
- `POST /api/transcribe` - Audio transcription via Whisper API (for Speak mode)

### Practice Modes System
- Two phases: Study (read & listen to learn material) and Practice (Cards, Fill, Order, Write, Speak exercises)
- Study mode: Click words for dictionary definitions, click sentences for translations, text-to-speech playback
- Cards mode: Bidirectional flashcard quiz with two sub-modes:
  - DE→RU: Shows German word, pick correct Russian translation
  - RU→DE: Shows Russian translation, pick correct German word
  - Each direction tracks progress separately; Cards is complete when both directions pass at 100%
  - Tab indicator shows "½" when one direction complete, checkmark when both complete
  - Requires 4+ flashcards with unique translations/German words
- Fill mode: Creates gaps ONLY for words in user's flashcard dictionary (one gap per unique word), click word bank to fill gaps
- Order mode: Uses saved sentences from Study mode (sentence interaction → Save button), displays Russian translation as hint, shuffle German words to reorder (min 3 words per sentence)
- Write mode: Creates gaps ONLY for flashcard dictionary words (one gap per unique word) with first-letter hints
- Speak mode: Pronunciation practice - plays German sentence via TTS, user repeats into microphone, Whisper transcribes, compares word-by-word with color-coded feedback (green=correct, red=incorrect)
- Strict validation with Check button (correct/incorrect feedback per gap/sentence)
- Flashcard-dependent modes (Fill, Write, Cards) track flashcardCount to detect new additions
- Order mode tracks saved sentence count separately
- When flashcard count increases, Cards mode appends new questions without resetting progress; other modes reinitialize with new gaps while preserving work
- Gap indexing uses stable gapId in templates with gapLookup for O(1) access
- FillMode captures existingWordInTarget before setState to avoid stale reads during drag/drop
- OrderMode uses useEffect for initialization to prevent crashes on empty sentences

### Saved Sentences System
- localStorage-backed sentence storage via `useSavedSentences` hook (key: "lingoflow-saved-sentences")
- In Study mode (sentence interaction mode), click sentence → translation panel shows Save button
- Saved sentence data: German text, Russian translation, source topicId/textId, timestamp
- Order practice mode uses only saved sentences (not auto-filtered by flashcard words)

### Flashcard System
- localStorage-backed flashcard storage via `useFlashcards` hook (key: "lingoflow-flashcards")
- In Study mode (word interaction mode), click words → Save button appears in dictionary panel
- Multi-select mode: Click "Выбрать" button → click multiple words to select (highlighted with ring) → "Сохранить все" button batch-saves all selected words as flashcards
- Flashcard data: German word, Russian translation, source topicId/textId, timestamp
- Cards practice mode requires minimum 4 flashcards with unique translations
- Quiz format: Shows German word, user selects correct Russian translation from 4 options
- Results screen shows percentage correct with option to practice again
- Mode marked complete only when 100% of questions answered correctly
- Export all flashcards to CSV via sidebar button (appears when flashcards exist)

### Progress Tracking System
- localStorage-backed progress persistence via `usePracticeProgress` hook
- Progress keyed by `topicId-textId` with fill/order/write/cards/speak boolean completion states
- 5 practice modes tracked: Fill, Order, Write, Cards, Speak
- A practice mode is marked complete when validationState becomes "correct" (or 100% on Cards)
- Order mode requires all sentences to be correct for completion
- Progress displayed in Reader header (percentage bar, X/5 fraction, green checkmark when 5/5 complete)
- Sidebar shows progress indicators next to each text (X/5 or checkmark)
- Green checkmark badges on individual practice tabs when completed
- Each practice tab has Reset button that clears both state and completion status
- Completion auto-resets when new flashcards are added (count increases)

### Batch MP3 Download Feature
- Selection mode in sidebar allows selecting multiple texts/topics
- Generates combined MP3 with spoken English intros before each text
- Audio structure: [English intro TTS] → [beep 800Hz 0.3s] → [German content TTS]
- Uses ffmpeg re-encoding (128kbps libmp3lame) for proper MP3 concatenation
- ID3v2 CHAP/CTOC tags for VLC chapter support via node-id3 library
- Temp files tracked and cleaned up after generation

### Data Flow
- Shared schemas in `/shared/schema.ts` define types used by both frontend and backend
- Route definitions in `/shared/routes.ts` provide type-safe API contracts
- Path aliases configured: `@/` for client source, `@shared/` for shared code

## External Dependencies

### AI Services
- **Azure OpenAI** or **OpenAI API** for:
  - Chat completions (translation, dictionary lookups)
  - Text-to-speech synthesis
- Configuration via environment variables:
  - `AZURE_OPENAI_API_KEY` or `OPENAI_API_KEY`
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_CHAT_DEPLOYMENT`
  - `AZURE_OPENAI_TTS_DEPLOYMENT`

### Database
- **PostgreSQL** with Drizzle ORM configured but not actively used for MVP
- Schema defined in `/shared/schema.ts`
- Drizzle config in `/drizzle.config.ts`
- Database URL via `DATABASE_URL` environment variable

### Caching
- Podcast audio files cached locally in `.cache/podcast/` directory
- Generated on first request, served from cache subsequently

### Development Tools
- Replit-specific Vite plugins for development (cartographer, dev-banner, error overlay)
- TypeScript with strict mode and bundler module resolution