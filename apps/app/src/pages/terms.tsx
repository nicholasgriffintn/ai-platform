import { Link } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { Prose } from "~/components/ui/Prose";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";
import {
  APP_NAME,
  CONTACT_LINK,
  JURISDICTION,
  TERMS_EFFECTIVE_DATE,
} from "~/constants";

export function meta() {
  return [
    { title: "Terms of Service - Polychat" },
    { name: "description", content: "Terms of Service for Polychat" },
  ];
}

export default function Terms() {
  return (
    <PageShell
      title="Terms of Service"
      sidebarContent={<StandardSidebarContent />}
    >
      <Prose>
        <h2>1. Introduction</h2>
        <p>
          Welcome to {APP_NAME} ("Service"). By accessing or using our AI
          chatbot services, you acknowledge that you have read, understood, and
          agree to be bound by these Terms of Service ("Terms"). If you do not
          agree to these Terms, please do not use our Service.
        </p>

        <h2>2. Use of Services</h2>
        <p>
          {APP_NAME} provides AI-powered conversational services. You agree to
          use these services only for lawful purposes and in a manner that does
          not violate the rights of, or restrict or inhibit the use and
          enjoyment of, the Service by any third party.
        </p>
        <h3>2.1 Age Requirements</h3>
        <p>
          You must be at least 18 years of age to use our services without
          permission. By using our services you represent that you are above the
          minimum age required by the laws of your country. If you are under the
          age of 18, you represent that you have your parent or guardian's
          permission to use the Service and they have read and agreed to these
          Terms on your behalf.
        </p>
        <h3>2.2 Service Description</h3>
        <p>
          {APP_NAME} is an AI-powered chatbot that allows users to interact with
          artificial intelligence language models. We utilize various AI
          technologies. The service provides automated responses to queries and
          facilitates interactive discussions.
        </p>
        <p>
          You acknowledge that:
          <ul>
            <li>
              The outputs generated might not always be accurate, complete, or
              up-to-date
            </li>
            <li>All outputs and responses are provided on an "as is" basis</li>
            <li>
              {APP_NAME} is not a substitute for professional or expert advice
            </li>
          </ul>
        </p>
        <p>
          We may update, improve, or change the functionality of {APP_NAME} at
          our discretion and without obligation. We do not guarantee that any
          specific feature will always be available.
        </p>

        <h2>3. Account Responsibilities</h2>
        <p>You are responsible for:</p>
        <ul>
          <li>Maintaining the confidentiality of your account credentials</li>
          <li>All activities that occur under your account</li>
          <li>
            Ensuring that your account information remains accurate and
            up-to-date
          </li>
          <li>
            Notifying us immediately of any unauthorized use of your account
          </li>
        </ul>

        <h2>4. Prohibited Activities</h2>
        <p>Users are strictly prohibited from:</p>
        <ul>
          <li>
            Using the Service for any illegal purpose or in violation of any
            local, state, national, or international law
          </li>
          <li>
            Transmitting any material that is harmful, threatening, abusive,
            harassing, defamatory, obscene, or otherwise objectionable
          </li>
          <li>
            Attempting to interfere with, compromise the system integrity or
            security, or circumvent any technical measures of the Service
          </li>
          <li>
            Engaging in any automated use of the system, such as using scripts
            to collect information or interact with the Service
          </li>
          <li>
            Uploading or transmitting viruses, malware, or other malicious code
          </li>
        </ul>
        <h3>4.1 AI Technology Limitations</h3>
        <p>
          You acknowledge that:
          <ul>
            <li>
              Our Service uses artificial intelligence technology that may not
              always provide accurate or complete information
            </li>
            <li>
              The AI may occasionally generate unexpected, inappropriate, or
              inaccurate responses
            </li>
            <li>
              You should not rely solely on our AI for critical decisions
              related to health, finances, legal matters, or other significant
              concerns
            </li>
            <li>
              We do not guarantee specific outcomes or results from using our AI
              Service
            </li>
          </ul>
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          All content, features, and functionality of the Service, including but
          not limited to design, text, graphics, interfaces, and code, are owned
          by {APP_NAME} or its licensors and are protected by copyright,
          trademark, and other intellectual property laws.
        </p>
        <h3>5.1 User Content License</h3>
        <p>
          By submitting or transmitting any content ("User Content") to{" "}
          {APP_NAME}, you grant us a non-exclusive, worldwide, royalty-free,
          sublicensable, and transferable license to store, display, process,
          and use your User Content in connection with providing and improving
          the Service.
        </p>
        <h3>5.2 Trademarks</h3>
        <p>
          All trademarks, service marks, logos, trade names, and any other
          proprietary designations belonging to {APP_NAME} used herein are our
          trademarks. Nothing in these Terms gives you the right to use any of
          our trademarks, logos, or brand elements.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, {APP_NAME} shall not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages resulting from your access to or use of, or inability to
          access or use, the Service.
        </p>

        <h2>7. Termination</h2>
        <p>These Terms remain in effect as long as you use {APP_NAME}.</p>
        <h3>7.1 Termination by You</h3>
        <p>You may stop using our Service at any time.</p>
        <h3>7.2 Termination by Us</h3>
        <p>
          We reserve the right to suspend or terminate your access to the
          Service, without prior notice or liability, for any reason, including
          breach of these Terms.
        </p>
        <h3>7.3 Effect of Termination</h3>
        <p>
          Upon termination, your rights to use our Service will immediately
          cease, and you must discontinue all use of the Service.
        </p>

        <h2>8. Changes to Terms</h2>
        <p>
          We may modify these Terms at any time at our sole discretion. If we
          make changes, we will provide notice by posting the updated Terms on
          our website. Your continued use of the Service after any such changes
          constitutes your acceptance of the new Terms.
        </p>

        <h2>9. Privacy</h2>
        <p>
          Your use of our Service is also governed by our{" "}
          <Link to="/privacy">Privacy Policy</Link>, which is incorporated into
          these Terms by reference.
        </p>

        <h2>10. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of the {JURISDICTION}, without regard to its conflict of law
          provisions.
        </p>
        <h3>10.1 Dispute Resolution</h3>
        <p>
          If you have a dispute with us:
          <ul>
            <li>
              Please contact us first at{" "}
              <a href={CONTACT_LINK}>{CONTACT_LINK}</a> to attempt informal
              resolution
            </li>
            <li>
              If the matter cannot be resolved informally within 30 days, either
              party may pursue litigation in the courts of the {JURISDICTION}
            </li>
            <li>
              Nothing in these Terms prevents you from filing a complaint with
              relevant regulatory authorities
            </li>
          </ul>
        </p>

        <h2>11. Disclaimer</h2>
        <p>
          The Service is provided on an "as is" and "as available" basis. We
          make no warranties, expressed or implied, regarding the operation or
          availability of the Service. The information provided is for general
          informational purposes only and should not be relied upon for making
          decisions of any kind.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless {APP_NAME} and its
          affiliates, officers, directors, employees, and agents, from and
          against all claims, damages, liabilities, losses, costs, and expenses
          (including reasonable attorneys' fees) arising out of or in any way
          connected with:
        </p>
        <ul>
          <li>Your use of our Service or any activities under your account;</li>
          <li>Your breach or alleged breach of these Terms;</li>
          <li>Your violation of any law or the rights of a third party.</li>
        </ul>

        <h2>13. Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact me at{" "}
          <a href={CONTACT_LINK}>{CONTACT_LINK}</a>.
        </p>

        <h2>14. Effective Date</h2>
        <p>
          These Terms of Service are effective as of {TERMS_EFFECTIVE_DATE}.
        </p>
      </Prose>
    </PageShell>
  );
}
