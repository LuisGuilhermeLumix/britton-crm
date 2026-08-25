interface Props {
  email: string | null;
  extras: string[] | null;
}

/** Primary email, with any alternates listed underneath. */
export function ContactEmails({ email, extras }: Props) {
  const others = Array.isArray(extras)
    ? extras.filter((entry) => typeof entry === 'string' && entry.trim() && entry !== email)
    : [];

  if (!email && !others.length) return null;

  return (
    <div className="other-numbers">
      <p className="label-sm" style={{ marginBottom: 8 }}>
        Email
      </p>
      {email && (
        <a className="contact-link email-primary" href={`mailto:${email}`}>
          {email}
        </a>
      )}
      {/* Omitted entirely when there are no alternates — no empty state. */}
      {others.length > 0 && (
        <ul className="contact-list" style={{ marginTop: email ? 6 : 0 }}>
          {others.map((entry) => (
            <li key={entry}>
              <a className="contact-link" href={`mailto:${entry}`}>
                {entry}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
