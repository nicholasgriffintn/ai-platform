import {
  APP_NAME,
  CONTACT_LINK,
  JURISDICTION,
  TERMS_EFFECTIVE_DATE,
} from "~/constants";
import { AppLayout } from "~/layouts/AppLayout";

export default function Terms() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 overflow-y-auto">
        <h1 className="text-4xl font-bold mb-4 text-zinc-900 dark:text-white">
          Terms of Service
        </h1>
        <div className="prose dark:prose-invert max-w-[840px]">
          <h2>1. Introduction</h2>
          <p>
            Welcome to {APP_NAME} ("Service"). By accessing or using our AI
            chatbot services, you acknowledge that you have read, understood,
            and agree to be bound by these Terms of Service ("Terms"). If you do
            not agree to these Terms, please do not use our Service.
          </p>

          <h2>2. Use of Services</h2>
          <p>
            {APP_NAME} provides AI-powered conversational services. You agree to
            use these services only for lawful purposes and in a manner that
            does not violate the rights of, or restrict or inhibit the use and
            enjoyment of, the Service by any third party.
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
              Uploading or transmitting viruses, malware, or other malicious
              code
            </li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            All content, features, and functionality of the Service, including
            but not limited to design, text, graphics, interfaces, and code, are
            owned by {APP_NAME} or its licensors and are protected by copyright,
            trademark, and other intellectual property laws.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, {APP_NAME} shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages resulting from your access to or use of, or
            inability to access or use, the Service.
          </p>

          <h2>7. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to the
            Service, without prior notice or liability, for any reason,
            including breach of these Terms. Upon termination, your right to use
            the Service will immediately cease.
          </p>

          <h2>8. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time at our sole discretion. If we
            make changes, we will provide notice by posting the updated Terms on
            our website. Your continued use of the Service after any such
            changes constitutes your acceptance of the new Terms.
          </p>

          <h2>9. Privacy</h2>
          <p>
            Your use of our Service is also governed by our Privacy Policy,
            which is incorporated into these Terms by reference.
          </p>

          <h2>10. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the {JURISDICTION}, without regard to its conflict of
            law provisions.
          </p>

          <h2>11. Disclaimer</h2>
          <p>
            The Service is provided on an "as is" and "as available" basis. We
            make no warranties, expressed or implied, regarding the operation or
            availability of the Service. The information provided is for general
            informational purposes only and should not be relied upon for making
            decisions of any kind.
          </p>

          <h2>12. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact me at{" "}
            <a href={CONTACT_LINK}>{CONTACT_LINK}</a>.
          </p>

          <h2>13. Effective Date</h2>
          <p>
            These Terms of Service are effective as of {TERMS_EFFECTIVE_DATE}.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
