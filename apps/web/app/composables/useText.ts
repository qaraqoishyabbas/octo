import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import type { User } from '~/types';

const decodeHtmlEntities = (value: string): string => {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
};

const MENTION_SHORTCODE_REGEX = /\[@([^\]]*)\]/g;

const decodeAttributeValue = (value: string): string => {
  return decodeHtmlEntities(value).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
};

const getShortcodeAttribute = (value: string, name: string): string => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(value ?? '').match(
    new RegExp(
      `\\s${escapedName}\\s*=\\s*("((?:\\\\.|[^"])*)"|'((?:\\\\.|[^'])*)'|([^\\s\\]]+))`,
      'i',
    ),
  );

  return decodeAttributeValue(match?.[2] ?? match?.[3] ?? match?.[4] ?? '');
};

const renderMentionShortcodesAsText = (value: string): string => {
  return String(value ?? '').replace(MENTION_SHORTCODE_REGEX, (match: string, attrs: string) => {
    const userId = getShortcodeAttribute(attrs, 'id');
    const label = getShortcodeAttribute(attrs, 'label');

    return label || (userId ? '@Пользователь' : match);
  });
};

const toPreviewText = (value: string): string => {
  const rawText = renderMentionShortcodesAsText(String(value ?? '')).trim();
  if (!rawText) {
    return '';
  }

  const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(rawText);
  if (!looksLikeHtml) {
    return rawText.replace(/\s+/g, ' ').trim();
  }

  const textWithBreaks = rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|pre|li|h[1-6])>/gi, '\n');
  const withoutTags = textWithBreaks.replace(/<[^>]+>/g, '');
  const decoded = decodeHtmlEntities(withoutTags);

  return decoded.replace(/\s+/g, ' ').trim();
};

type MentionUser = Pick<User, 'id' | 'username' | 'name' | 'first_name' | 'last_name'>;

type UseTextOptions = {
  mentionUsers?: MaybeRefOrGetter<MentionUser[] | Map<string, MentionUser> | undefined>;
};

export function useText(
  text: MaybeRefOrGetter<string | null | undefined>,
  options: UseTextOptions = {},
) {
  const ALLOWED_TAGS = new Set([
    'p',
    'pre',
    'code',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'br',
    'a',
  ]);
  const LINK_REGEX = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)]|(?:https?:\/\/|www\.)[^\s<]+)/gi;

  const escapeHtml = (value: string): string => {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll('`', '&#96;');

  const normalizeLinkHref = (value: string): string => {
    const href = decodeHtmlEntities(String(value ?? '')).trim();
    if (!href || /[\u0000-\u001F\u007F\s]/.test(href)) {
      return '';
    }

    const normalizedHref = href.startsWith('www.') ? `https://${href}` : href;

    try {
      const url = new URL(normalizedHref);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
        return '';
      }

      return normalizedHref;
    } catch {
      return '';
    }
  };

  const renderLink = (href: string, label: string): string => {
    const normalizedHref = normalizeLinkHref(href);
    if (!normalizedHref) {
      return label;
    }

    return `<a href="${escapeAttribute(normalizedHref)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  };

  const mentionUsersById = computed(() => {
    const rawUsers = toValue(options.mentionUsers);

    if (rawUsers instanceof Map) {
      return rawUsers;
    }

    const users = new Map<string, MentionUser>();
    (rawUsers ?? []).forEach((user) => {
      const userId = String(user.id ?? '').trim();
      if (userId) {
        users.set(userId, user);
      }
    });

    return users;
  });

  const getMentionLabel = (userId: string, fallbackLabel?: string): string => {
    const user = mentionUsersById.value.get(String(userId ?? '').trim());
    const name = String(user?.name ?? '').trim();

    if (name) {
      return name;
    }

    const fullName =
      `${String(user?.first_name ?? '').trim()} ${String(user?.last_name ?? '').trim()}`.trim();
    return fullName || String(fallbackLabel ?? '').trim() || 'Пользователь';
  };

  const getAttributeValue = (value: string, name: string): string => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(value ?? '').match(
      new RegExp(`\\s${escapedName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
    );
    return decodeHtmlEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? '');
  };

  const renderMention = (userId: string, fallbackLabel?: string): string => {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId) {
      return '';
    }

    const label = getMentionLabel(normalizedUserId, fallbackLabel);
    return `<span class="message-mention" data-mention="${escapeAttribute(normalizedUserId)}" role="button" tabindex="0">${escapeHtml(label)}</span>`;
  };

  const renderMentionShortcodes = (value: string): string => {
    const tokens: string[] = [];
    const output = String(value ?? '').replace(
      MENTION_SHORTCODE_REGEX,
      (match: string, attrs: string) => {
        const userId = getShortcodeAttribute(attrs, 'id');
        const label = getShortcodeAttribute(attrs, 'label');

        if (!userId) {
          return match;
        }

        const token = `%%MENTION_SHORTCODE_${tokens.length}%%`;
        tokens.push(renderMention(userId, label));
        return token;
      },
    );

    return renderPlainTextValue(output).replace(
      /%%MENTION_SHORTCODE_(\d+)%%/g,
      (_match, index: string) => tokens[Number(index)] ?? '',
    );
  };

  const renderPlainTextValue = (value: string): string => {
    let output = escapeHtml(String(value ?? ''));

    output = output.replace(LINK_REGEX, (match: string) => renderLink(match, match));
    output = output.replaceAll('\n', '<br>');

    return output;
  };

  const renderPlainText = (value: string): string => {
    return renderMentionShortcodes(value);
  };

  const sanitizeRichText = (value: string): string => {
    const codeTokens: string[] = [];
    const mentionTokens: string[] = [];
    let output = String(value ?? '');

    output = output.replace(
      /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_match, code: string) => {
        const normalizedCode = decodeHtmlEntities(String(code ?? ''));
        const token = `%%CODE_BLOCK_${codeTokens.length}%%`;
        codeTokens.push(`<pre><code>${escapeHtml(normalizedCode)}</code></pre>`);
        return token;
      },
    );

    output = output.replace(
      /<span\b[^>]*data-type\s*=\s*("mention"|'mention'|mention)[^>]*>([\s\S]*?)<\/span>/gi,
      (match: string, _type: string, label: string) => {
        const id = getAttributeValue(match, 'data-id');
        const labelText = decodeHtmlEntities(
          String(label ?? '')
            .replace(/<[^>]+>/g, '')
            .trim(),
        );
        const userId = id;
        const token = `%%MENTION_HTML_${mentionTokens.length}%%`;

        mentionTokens.push(renderMention(userId, labelText));
        return token;
      },
    );

    output = output.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, code: string) => {
      const normalizedCode = decodeHtmlEntities(String(code ?? ''));
      const token = `%%CODE_INLINE_${codeTokens.length}%%`;
      codeTokens.push(`<code>${escapeHtml(normalizedCode)}</code>`);
      return token;
    });

    output = output.replace(/<!--[\s\S]*?-->/g, '');
    output = output.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
    output = output.replace(/\son[a-z-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
    output = output.replace(
      /\s(?:style|class|id|data-[a-z0-9-]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi,
      '',
    );
    output = output.replace(
      /<(\/?)([a-z0-9-]+)([^>]*)>/gi,
      (_match, slash: string, tag: string) => {
        const normalizedTag = String(tag ?? '').toLowerCase();
        if (!ALLOWED_TAGS.has(normalizedTag)) {
          return '';
        }
        if (normalizedTag === 'a') {
          if (slash) {
            return '</a>';
          }

          const href = String(_match ?? '').match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
          const normalizedHref = normalizeLinkHref(href?.[2] ?? href?.[3] ?? href?.[4] ?? '');
          if (!normalizedHref) {
            return '';
          }

          return `<a href="${escapeAttribute(normalizedHref)}" target="_blank" rel="noopener noreferrer nofollow">`;
        }
        return slash ? `</${normalizedTag}>` : `<${normalizedTag}>`;
      },
    );

    const sanitizedText = output.replace(/<[^>]+>/g, '').trim();
    if (!sanitizedText && String(value ?? '').trim()) {
      return `${escapeHtml(String(value ?? ''))}`.replaceAll('\n', '<br>');
    }

    output = output.replace(
      /%%CODE_(?:BLOCK|INLINE)_(\d+)%%/g,
      (_match, index: string) => codeTokens[Number(index)] ?? '',
    );
    output = output.replace(
      /%%MENTION_HTML_(\d+)%%/g,
      (_match, index: string) => mentionTokens[Number(index)] ?? '',
    );

    return output;
  };

  const renderedTextHtml = computed(() => {
    const rawValue = String(toValue(text) ?? '');
    if (!rawValue) {
      return '';
    }

    const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(rawValue);
    if (!looksLikeHtml) {
      return renderPlainText(rawValue);
    }

    return sanitizeRichText(rawValue);
  });

  const renderedTextPreview = computed(() => toPreviewText(String(toValue(text) ?? '')));

  return {
    renderedTextHtml,
    renderedTextPreview,
  };
}
