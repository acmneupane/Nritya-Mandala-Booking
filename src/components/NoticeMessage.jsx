import { noticeHtml } from "../lib/notices";

// Renders a studio notice's message (rich-text HTML, or older plain text).
export default function NoticeMessage({ message, style }) {
  return <div className="rich-text-content notice-content" style={style} dangerouslySetInnerHTML={{ __html: noticeHtml(message) }} />;
}
