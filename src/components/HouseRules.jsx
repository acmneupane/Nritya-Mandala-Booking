import { T } from "../lib/theme";

export function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontFamily: "Fraunces, serif", fontSize: 14, color: T.maroonDark, marginBottom: 4 }}>{title}</h4>
      <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

// The studio's house rules — shared between the enrolment form (where they're
// shown inline, with the "Requested time" line filled in via `locationExtra`)
// and the standalone /house-rules page linked from the Renewal, Transfer, and
// legal (Privacy Policy / Terms) pages. Content is unchanged from what's always
// been on the enrolment form — only where it's shown from has changed.
export function HouseRulesSections({ studioAddress, locationExtra }) {
  return (
    <>
      <InfoSection title="Location & Time">
        {studioAddress} — behind the Oran Park Library, in the Sandown Rooms. Enter from the side/rear of the library (the left-hand side as you face the building). Classes are usually held in Sandown Room 1, though this can occasionally change to Room 2 or 3 depending on room availability.<br /><br />
        {locationExtra}
      </InfoSection>

      <InfoSection title="Parking">
        Street parking is available around the library, or you're welcome to use the Oran Park Library or Oran Park Leisure Centre car parks nearby.
      </InfoSection>

      <InfoSection title="How We Communicate">
        We mostly get in touch by email, so please make sure the email address on file is one you check regularly. If we have a phone number on file, we may also give you a call for anything urgent.
      </InfoSection>

      <InfoSection title="Payment Confirmation">
        Bank transfers can take up to 24 hours to clear, so please allow a little time for your enrolment to be confirmed after paying.<br /><br />
        <strong>Your student's place in the class will be confirmed once payment has been received.</strong>
      </InfoSection>

      <InfoSection title="Attendance & Punctuality">
        Please arrive at least 5 minutes before class, ready to dance. Regular attendance is encouraged as it helps students keep up with their routines and make the most of their classes. Please let us know if your student will be absent.
      </InfoSection>

      <InfoSection title="Illness Policy">
        Please keep your student home if they're unwell or showing signs of a contagious illness — we'd rather they rest and recover than risk passing something on to their classmates. Just let us know if they'll be away.
      </InfoSection>

      <InfoSection title="Clothing, Shoes & Hair">
        Students should wear comfortable clothing suitable for dancing, such as activewear. Correctly fitting and comfortable dance shoes should be worn — flip-flops are not permitted. Long hair should be neatly tied back and kept away from the face where possible.
      </InfoSection>

      <InfoSection title="Water Bottle">
        Dancing is thirsty work — please send your student along with a labelled water bottle (or another hydrating drink) so they can stay refreshed and get the most out of class.
      </InfoSection>

      <InfoSection title="Parents & Guardians">
        Parents and guardians are encouraged to remain outside the dance room during classes. This helps minimise distractions and allows students to focus on learning.
      </InfoSection>

      <InfoSection title="Personal Belongings">
        Please avoid bringing valuables, large amounts of cash or unnecessary personal belongings to class. Nritya Mandala accepts no responsibility for belongings that are lost, damaged or stolen.
      </InfoSection>

      <InfoSection title="Cancellation Policy">
        If your student is unable to attend a class, please notify Nritya Mandala at least 24 hours before the scheduled class. Cancellations made less than 24 hours before the class may not be eligible for a make-up class or credit. We understand that emergencies and unexpected circumstances can happen, and these will be considered on a case-by-case basis. Thank you for helping us manage class spaces and provide the best experience for all students.
      </InfoSection>

      <InfoSection title="Studio Closures">
        Nritya Mandala is closed on major Nepali festivals such as Dashain and Tihar, as well as some public holidays and school breaks. Exact closure dates can vary year to year — please check with the team for the current schedule.
      </InfoSection>

      <InfoSection title="Photos & Videos">
        Photos and videos taken during classes and studio events — which may include any student enrolled at Nritya Mandala, including through this form — may be used in the studio's marketing, including on social media. If you would prefer your student not be included, please let us know directly and we'll do our best to accommodate this for future content. Please note that once footage featuring a full class has been shared, it may not always be possible to remove or edit around a particular student.
      </InfoSection>

      <InfoSection title="Parent Photography">
        Feel free to take photos or videos of your own student. Please just be mindful that other students may appear in the background, and avoid sharing images that feature other families' children without their permission.
      </InfoSection>

      <InfoSection title="Safe & Respectful Environment">
        Nritya Mandala is committed to providing a safe, welcoming and non-discriminatory environment for all students, parents and teachers. Bullying, harassment and disrespectful behaviour are not tolerated.
      </InfoSection>
    </>
  );
}
