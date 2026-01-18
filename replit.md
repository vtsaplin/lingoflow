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