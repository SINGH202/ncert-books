import { Typography } from "@/components/typography";

export function NcertAttribution({
  ncertBookUrl,
  className,
}: {
  ncertBookUrl?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Typography variant="small" className="block max-w-prose">
        Textbook content is published by NCERT. This site does not host NCERT
        files; PDFs are loaded from the official NCERT textbook portal for
        preview only. Republication or redistribution is prohibited.
      </Typography>
      {ncertBookUrl ? (
        <a
          href={ncertBookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="touch-target mt-2 inline-flex items-center"
        >
          <Typography variant="link">Open on NCERT</Typography>
        </a>
      ) : (
        <a
          href="https://ncert.nic.in/textbook.php"
          target="_blank"
          rel="noopener noreferrer"
          className="touch-target mt-2 inline-flex items-center"
        >
          <Typography variant="link">NCERT Textbook Portal</Typography>
        </a>
      )}
    </div>
  );
}
