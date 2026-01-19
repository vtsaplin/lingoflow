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

### Practice Modes System
- Two phases: Study (read & listen to learn material) and Practice (Cards, Fill, Order, Write exercises)
- Study mode: Click words for dictionary definitions, click sentences for translations, text-to-speech playback
- Cards mode: Flashcard quiz - match German words to Russian translations (multiple choice, 4 options)
- Fill mode: 20% of words become gaps, drag words from word bank to fill
- Order mode: Shuffle sentence words, drag to reorder (min 3 words per sentence)
- Write mode: 25% of words become gaps with first-letter hints
- Strict validation with Check button (correct/incorrect feedback per gap/sentence)
- Gap indexing uses stable gapId in templates with gapLookup for O(1) access
- FillMode captures existingWordInTarget before setState to avoid stale reads during drag/drop
- OrderMode uses useEffect for initialization to prevent crashes on empty sentences

### Flashcard System
- localStorage-backed flashcard storage via `useFlashcards` hook (key: "lingoflow-flashcards")
- In Study mode (word interaction mode), click words → Save button appears in dictionary panel
- Flashcard data: German word, Russian translation, source topicId/textId, timestamp
- Cards practice mode requires minimum 4 flashcards with unique translations
- Quiz format: Shows German word, user selects correct Russian translation from 4 options
- Results screen shows percentage correct with option to practice again
- Export all flashcards to CSV via sidebar button (appears when flashcards exist)

### Progress Tracking System
- localStorage-backed progress persistence via `usePracticeProgress` hook
- Progress keyed by `topicId-textId` with fill/order/write boolean completion states
- A practice mode is marked complete when validationState becomes "correct"
- Order mode requires all sentences to be correct for completion
- Progress displayed in Reader header (percentage bar, X/3 fraction, green checkmark when complete)
- Sidebar shows progress indicators next to each text (X/3 or checkmark)
- Green checkmark badges on individual practice tabs when completed

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