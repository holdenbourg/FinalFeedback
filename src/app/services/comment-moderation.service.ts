import { inject, Injectable } from '@angular/core';
import { UsersService } from './users.service';
import { LocalStorageService } from './local-storage.service';

export type CommentType = 'comment' | 'reply';
export interface CommentContext {
  postId: string;
  authorUserId?: string;
  authorUsername: string;
  type: CommentType;
  parentCommentId?: string;
  parentAuthorUsername?: string;
  existing: Array<{
    id: string;
    authorUsername: string;
    text: string;
  }>;
  nowIso?: string;
}

export type CommentCheckResult =
  | { ok: true; text: string; mentions: string[] }
  | { ok: false; error: string };

export type MentionToken = { text: string; handle?: string; adjacentPrev?: boolean };

@Injectable({ providedIn: 'root' })
export class CommentModerationService {
    private usersService = inject(UsersService);
    private localStorageService = inject(LocalStorageService);

    /// ----- Helper Variables ------ \\\
    private readonly MINIMUM_LENGTH = 2;
    private readonly MAXIMUM_LENGTH = 150;
    private readonly MAXIMUM_LINKS = 2;

    private lastKey(u: string) { 
        return `last-comment-at:${u}`; 
    }

    ///  map common leetspeak/symbols to letters for profanity detection  \\\
    private leetMap: Record<string, string> = {
        '0': 'o', 'º': 'o', '®': 'r',
        '1': 'i', '!': 'i', '|': 'i', 'l': 'i',
        '2': 'z',
        '3': 'e', '€': 'e',
        '4': 'a', '@': 'a',
        '5': 's', '$': 's',
        '6': 'g',
        '7': 't',
        '8': 'b',
        '9': 'g'
    };

    private denyListExact = [
        'nigger',
        'knigger',
        'nigga',
        'knigga',
        'coon',
        'koon',
        'jigaboo',
        'rape',
        'rapist',
        'raped',
        'raper',
        'slut',
        'whore',
        'faggot',
        'faggotry'
    ];

    private denyListPatterns: RegExp[] = [
        /(https?:\/\/[^\s]+)/gi,                 /// links
        /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g,    /// control chars
        /(.)\1{9,}/,                             /// repeated chars
        /\b(n+i+g+g+e+r+|n+i+g+g+a+|c+o+o+n+|j+i+g+a+b+o+o+|r+a+p+e+|r+a+p+i+s+t+|r+a+p+e+d+|r+a+p+e+r+|s+l+u+t+|w+h+o+r+e+|f+a+g+g+o+t+|f+a+g+g+o+t+r+y+)\b/gi
    ];

    validate(inputRaw: string, commentContext: CommentContext): CommentCheckResult {
        ///  Check for empty or space filled comment/reply  \\\
        const input = (inputRaw ?? '').trim();

        if (!input) return { ok: false, error: 'Comment cannot be empty' };

        ///  Make sure comment/reply is with character range (2-150)  \\\
        if (input.length < this.MINIMUM_LENGTH || input.length > this.MAXIMUM_LENGTH) {
            return { ok: false, error: `Comment must be ${this.MINIMUM_LENGTH}–${this.MAXIMUM_LENGTH} characters, you're at ${inputRaw.length}` };
        }

        ///  Make sure comment/reply has no control/non-printable characters  \\\
        if (this.hasControlChars(input)) {
            return { ok: false, error: 'Remove control/non-printable characters' };
        }

        ///  Make sure comment/reply doesn't allow spam (loooooooooool)  \\\
        if (/(.)\1{9,}/i.test(input)) {
            return { ok: false, error: 'Please avoid long repeated characters' };
        }

        ///  Make sure comment/reply doesn't contain more than 2 links  \\\
        const linkCount = (input.match(/\bhttps?:\/\/[^\s)]+/gi) ?? []).length;

        if (linkCount > this.MAXIMUM_LINKS) {
            return { ok: false, error: `Limit links to at most ${this.MAXIMUM_LINKS}` };
        }

        ///  Make sure comment/reply doesn't @ the same user twice or @ user that doesn't exist  \\\
        const { corrected, duplicate } = this.canonicalizeMentionsAndFindDup(input);

        if (duplicate) {
            return { ok: false, error: 'You cannot @ the same user twice' };
        }

        ///  Make sure the atted username is as it is in the database (@holdenbourg -> @HoldenBourg)  \\\
        const mentions = this.extractMentions(corrected);

        const nonExistent = mentions.filter(u => !this.usersService.usernameExistsCaseInsensitive?.(u));

        if (nonExistent.length) {
            return { ok: false, error: `@${nonExistent[0]} does not exist` };
        }

        ///  Make sure comment/reply doesn't contain any profanity  \\\
        if (this.containsProfanity(corrected)) {
            return { ok: false, error: 'Please remove profanity before posting' };
        }

        ///  Only allow a user to post a comment/reply every two seconds  \\\
        const now = Date.now();
        const last = Number(localStorage.getItem(this.lastKey(commentContext.authorUsername)) || '0');

        if (now - last < 2000) {
            return { ok: false, error: `You're commenting too fast, please wait a moment` };
        }

        ///  Make sure reply context is valid  \\\
        if (commentContext.type === 'reply') {
            const parentId = commentContext.parentCommentId;
            if (!parentId) {
                return { ok: false, error: 'Missing reply target' };
            }

            const parent = commentContext.existing.find(c => c.id === parentId);
            if (!parent) {
                return { ok: false, error: 'Reply target no longer exists' };
            }
        }

        ///  If comment/reply passes everything, set the rate-limit timestamp  \\\
        localStorage.setItem(this.lastKey(commentContext.authorUsername), String(now));

        ///  Strip the comment/reply of control/non-printable characters  \\\
        const cleaned = this.stripControlChars(corrected);

        return { ok: true, text: cleaned, mentions };
    }

    /**
     * Validate caption for posts (more lenient than comments)
     * Captions can be empty and have no minimum length requirement
     */
    validateCaption(inputRaw: string, username: string): CommentCheckResult {
        const input = (inputRaw ?? '').trim();

        ///  Caption CAN be empty - this is allowed  \\\
        if (!input) {
            return { ok: true, text: '', mentions: [] };
        }

        ///  Make sure caption doesn't exceed maximum length (150)  \\\
        if (input.length > this.MAXIMUM_LENGTH) {
            return { ok: false, error: `Caption cannot exceed ${this.MAXIMUM_LENGTH} characters, you're at ${inputRaw.length}` };
        }

        ///  Make sure caption has no control/non-printable characters  \\\
        if (this.hasControlChars(input)) {
            return { ok: false, error: 'Remove control/non-printable characters' };
        }

        ///  Make sure caption doesn't allow spam (loooooooooool)  \\\
        if (/(.)\1{9,}/i.test(input)) {
            return { ok: false, error: 'Please avoid long repeated characters' };
        }

        ///  Make sure caption doesn't contain more than 2 links  \\\
        const linkCount = (input.match(/\bhttps?:\/\/[^\s)]+/gi) ?? []).length;

        if (linkCount > this.MAXIMUM_LINKS) {
            return { ok: false, error: `Limit links to at most ${this.MAXIMUM_LINKS}` };
        }

        ///  Make sure caption doesn't @ the same user twice or @ user that doesn't exist  \\\
        const { corrected, duplicate } = this.canonicalizeMentionsAndFindDup(input);

        if (duplicate) {
            return { ok: false, error: 'You cannot @ the same user twice' };
        }

        ///  Make sure the atted username is as it is in the database (@holdenbourg -> @HoldenBourg)  \\\
        const mentions = this.extractMentions(corrected);

        const nonExistent = mentions.filter(u => !this.usersService.usernameExistsCaseInsensitive?.(u));

        if (nonExistent.length) {
            return { ok: false, error: `@${nonExistent[0]} does not exist` };
        }

        ///  Make sure caption doesn't contain any profanity  \\\
        if (this.containsProfanity(corrected)) {
            return { ok: false, error: 'Please remove profanity before posting' };
        }

        ///  Strip the caption of control/non-printable characters  \\\
        const cleaned = this.stripControlChars(corrected);

        return { ok: true, text: cleaned, mentions };
    }

    /// ---------------------------------------- Helper Methods ---------------------------------------- \\\
    private extractMentions(s: string): string[] {
        const out: string[] = [];
        const re = /@([A-Za-z0-9._-]+)/g;

        let m: RegExpExecArray | null;

        while ((m = re.exec(s)) !== null) out.push(m[1]);

        return out;
    }

    private hasDuplicateMentions(list: string[]) {
        const seen = new Set<string>();

        for (const u of list) {
            if (seen.has(u)) return true;
            seen.add(u);
        }

        return false;
    }

    private hasControlChars(s: string) {
        return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s);
    }

    private stripControlChars(s: string) {
        return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    private normalizeForProfanity(s: string) {
        let t = s.toLowerCase();

        ///  map leetspeak/symbols  \\\
        t = Array.from(t).map(ch => this.leetMap[ch] ?? ch).join('');

        ///  collapse repeated letters (e.g., “baaaad” → “baad”)  \\\
        t = t.replace(/([a-z])\1{1,}/g, '$1$1');

        ///  drop common separators used for obfuscation  \\\
        t = t.replace(/[\s._\-*]+/g, '');

        return t;
    }

    private containsProfanity(s: string) {
        const norm = this.normalizeForProfanity(s);

        ///  Check for exact matches  \\\
        for (const w of this.denyListExact) {
            if (norm.includes(w)) return true;
        }

        ///  Check for patterns  \\\
        for (const rx of this.denyListPatterns) {
            if (rx.test(norm)) return true;
        }

        return false;
    }

    tokenizeMentions(input: string | null | undefined): MentionToken[] {
        const str = input ?? '';

        if (!str) return [];

        const re = /@([A-Za-z0-9._-]+)/g;
        const tokens: MentionToken[] = [];

        let last = 0;
        let prevWasHandle = false;
        let m: RegExpExecArray | null;

        while ((m = re.exec(str)) !== null) {
            const start = m.index;
            const end = re.lastIndex;

            const gap = str.slice(last, start);

            if (gap.length > 0) {
                tokens.push({ text: gap });
                prevWasHandle = false;
            }

            tokens.push({
                text: '@' + m[1],
                handle: m[1],
                adjacentPrev: prevWasHandle && gap.length === 0
            });

            prevWasHandle = true;
            last = end;
        }

        if (last < str.length) tokens.push({ text: str.slice(last) });

        return tokens;
    }

    ///  Return the accurate username if atted incorrectly (@Holdenbourg -> @HoldenBourg)  \\\
    async canonicalizeHandleAsync(rawUsername: string): Promise<string> {
        const raw = String(rawUsername ?? '').trim();
        if (!raw) return raw;

        // Remove leading "@" if present
        const handle = raw.replace(/^@/, '');

        // Query Supabase for proper-cased username
        const profile = await this.usersService.getUserProfileByUsername(handle);

        if (profile?.username) {
            return '@' + profile.username;   // Preserve @ for UI consistency
        }

        // No match → fallback to raw input
        return raw.startsWith('@') ? raw : '@' + raw;
    }

    private userLowerToCanonical(): Map<string, string> {
        const users = (this.localStorageService?.getInformation?.('users') as Array<{ username: string }> | undefined) ?? [];
        const map = new Map<string, string>();

        for (const u of users) map.set(u.username.toLowerCase(), u.username);

        return map;
    }

    private canonicalizeMentionsAndFindDup(text: string): { corrected: string; duplicate?: string } {
        const usersMap = this.userLowerToCanonical();
        const seen = new Set<string>();

        let dupCanonical: string | undefined;

        const corrected = text.replace(/@([A-Za-z0-9._-]+)/g, (_full, raw: string) => {
            const lower = String(raw).toLowerCase();
            const canonical = usersMap.get(lower) ?? raw;

            if (seen.has(lower) && !dupCanonical) dupCanonical = canonical;
            
            seen.add(lower);

            return '@' + canonical;
        });

        return { corrected, duplicate: dupCanonical };
    }
}