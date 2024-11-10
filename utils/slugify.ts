export function slugify(text: string): string {
    return text
      .toString()
      .normalize('NFKD')               // Split accented characters into their base characters and diacritical marks
      .replace(/[\u0300-\u036f]/g, '') // Remove all diacritical marks
      .toLowerCase()
      .trim()
      .replace(/[&/\\#,+()$~%.'":*?<>{}]/g, '') // Remove special chars
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '')             // Trim - from end of text
      .replace(/--+/g, '-');          // Replace multiple - with single -
  }