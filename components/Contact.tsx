import { ISSUES_URL, contactEmail } from "./site";

/** One sentence that names every way to reach the operator. Used by privacy, terms and support. */
export function ContactLine() {
  const email = contactEmail();
  return (
    <p>
      {email ? (
        <>
          E-mail: <a href={`mailto:${email}`}>{email}</a>.{" "}
        </>
      ) : null}
      Public questions and bug reports:{" "}
      <a href={ISSUES_URL} rel="noopener">
        GitHub issues
      </a>
      .{email ? "" : " There is no e-mail address yet; the issue tracker is the contact channel."}
    </p>
  );
}
