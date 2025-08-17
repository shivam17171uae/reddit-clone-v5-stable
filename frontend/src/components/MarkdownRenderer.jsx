import React from 'react'; import ReactMarkdown from 'react-markdown'; import remarkGfm from 'remark-gfm'; import rehypeRaw from 'rehype-raw';
function MarkdownRenderer({ content }) { return ( <ReactMarkdown className="prose prose-invert prose-sm max-w-none" remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} linkTarget="_blank">{content}</ReactMarkdown> );}
export default MarkdownRenderer;
