import path from 'path';
import fs from 'fs';
import ejs from 'ejs';

export interface RenderEmailOptions {
  template: string;
  data: Record<string, unknown>;
}

export interface RenderedEmail {
  html: string;
  text: string;
  subject?: string;
}

/**
 * Locate the emails directory in either src or dist depending on execution environment.
 */
export const getTemplatesDirectory = (): string => {
  const candidatePaths = [
    path.resolve(process.cwd(), 'src/templates/emails'),
    path.resolve(process.cwd(), 'dist/templates/emails'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to src directory
  return candidatePaths[0];
};

/**
 * Generates clean plain text fallback from rendered HTML.
 */
export const htmlToPlainText = (html: string): string => {
  return (
    html
      // Convert anchor tags to "text (url)"
      .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      // Convert line breaks and paragraph tags to newlines
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#127881;/g, '')
      .replace(/&#9888;/g, '[!]')
      .replace(/&#10004;/g, '[OK]')
      .replace(/&#9432;/g, '[i]')
      .replace(/&#128075;/g, '')
      // Normalize excessive whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim()
  );
};

/**
 * Renders an EJS email template with the base layout.
 */
export const renderEmailTemplate = async (
  templateName: string,
  data: Record<string, unknown> = {}
): Promise<RenderedEmail> => {
  const baseDir = getTemplatesDirectory();
  const cleanTemplateName = templateName.replace(/\.ejs$/, '');
  const templatePath = path.join(baseDir, `${cleanTemplateName}.ejs`);
  const layoutPath = path.join(baseDir, 'layouts', 'base.ejs');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templatePath}`);
  }

  if (!fs.existsSync(layoutPath)) {
    throw new Error(`Email layout not found: ${layoutPath}`);
  }

  // Enrich data with common defaults
  const templateData: Record<string, unknown> = {
    ...data,
    year: data.year || new Date().getFullYear(),
    appName: data.appName || 'PulseBridge',
  };

  // Render the inner body template
  const bodyHtml = await ejs.renderFile(templatePath, templateData, {
    views: [baseDir],
  });

  // Render the full email wrapping the body inside the base layout
  const fullHtml = await ejs.renderFile(
    layoutPath,
    {
      ...templateData,
      body: bodyHtml,
      subject: (templateData.subject as string) || 'PulseBridge Notification',
    },
    {
      views: [baseDir],
    }
  );

  const textFallback = htmlToPlainText(bodyHtml);

  return {
    html: fullHtml,
    text: textFallback,
    subject: typeof templateData.subject === 'string' ? templateData.subject : undefined,
  };
};
