import { Prose } from "@ngriffin_uk/polychat-component-content";
import { APP_NAME, CONTACT_LINK } from "@ngriffin_uk/polychat-library-client";
import { AGE_GATE_MINIMUM_AGE } from "@ngriffin_uk/polychat-schemas";

import { PageShell } from "../Shell/PageShell.js";
import { StandardSidebarContent } from "../Sidebar/StandardSidebarContent.js";

export function AgeCheckPage() {
  return (
    <PageShell
      title="Why we ask for your date of birth"
      sidebarContent={<StandardSidebarContent />}
    >
      <Prose>
        <p>
          Before your first message, {APP_NAME} asks for your date of birth. It is a one-off check
          that the person at the keyboard is {AGE_GATE_MINIMUM_AGE} or over. Here is why we ask,
          what we keep and what happens next.
        </p>

        <h2>Why we ask</h2>
        <ul>
          <li>
            <strong>{APP_NAME} is for adults.</strong> AI models can produce material that is not
            suitable for children, and we do not offer a version designed for them. Our{" "}
            <a href="/terms">Terms of Service</a> require you to be {AGE_GATE_MINIMUM_AGE} or over.
          </li>
          <li>
            <strong>To keep children away from content that is not meant for them.</strong> Asking
            before the first message stops younger people from using the chat at all, rather than
            relying on filters after the fact.
          </li>
          <li>
            <strong>To follow the law where you live.</strong> UK and EU rules expect online
            services to know whether children are likely to use them, and to protect them if so.
            Keeping {APP_NAME} adults-only is how we meet that.
          </li>
        </ul>

        <h2>What we keep</h2>
        <ul>
          <li>
            <strong>Only the outcome.</strong> We record whether you are {AGE_GATE_MINIMUM_AGE} or
            over, and when you told us. We use your date of birth once to work out your age, then
            throw it away. We never store it.
          </li>
          <li>
            <strong>Where it is kept.</strong> If you are signed in, the outcome is stored with your
            account. If you are not, it is stored with your anonymous session, which we identify
            from a hashed version of your connection details.
          </li>
          <li>
            <strong>What it is not used for.</strong> It is not shown to anyone, not used for
            advertising or to personalise answers, and not shared with model providers or other
            third parties.
          </li>
          <li>
            <strong>Why we can process it.</strong> Under UK GDPR and the EU GDPR, we rely on our
            legal obligations and on our legitimate interest in keeping {APP_NAME} adults-only.
          </li>
        </ul>

        <h2>What happens next</h2>
        <ul>
          <li>
            <strong>If you are {AGE_GATE_MINIMUM_AGE} or over,</strong> your message sends and we
            will not ask again on that account.
          </li>
          <li>
            <strong>If you skip the question,</strong> you can keep looking around, but you cannot
            send messages. We ask again the next time you try.
          </li>
          <li>
            <strong>If you are under {AGE_GATE_MINIMUM_AGE},</strong> sending messages stays
            switched off for that account.
          </li>
        </ul>
        <p>
          The same rule applies everywhere you use {APP_NAME}: on the web, the desktop and iPhone
          apps, and the API.
        </p>

        <h2>If you made a mistake</h2>
        <p>
          You cannot change your answer in the app, because a check you can retry is not much of a
          check. If you entered the wrong date, <a href={CONTACT_LINK}>contact us</a>. We will look
          into it and may ask you to confirm your age another way.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask us for a copy of what we hold about you, or ask us to delete it along with
          your account. See our <a href="/privacy">Privacy Policy</a> for how to make a request.
        </p>
        <p>
          If you are unhappy with how we handle your data, you can complain to the{" "}
          <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner's Office</a> in
          the UK, or to the{" "}
          <a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en">
            data protection authority
          </a>{" "}
          in your EU country.
        </p>
      </Prose>
    </PageShell>
  );
}
