// Short, practical guides for families and executors. Each one is its own page at
// /guides/:slug (with its own title and description for search) and links into the
// matching service pages.

export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  summary: string;
  readMinutes: number;
  // Service page the guide sends readers to when they're ready to hire.
  serviceSlug: string;
  serviceCta: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: 'estate-cleanout-cost',
    title: 'How Much Does an Estate Cleanout Cost?',
    description:
      'What drives the price of an estate cleanout, how companies quote, what a fair quote includes, and practical ways to lower the cost.',
    summary: 'What drives the price, how companies quote, and how to keep the bill down.',
    readMinutes: 4,
    serviceSlug: 'estate-cleanouts',
    serviceCta: 'Compare estate cleanout companies',
    sections: [
      {
        paragraphs: [
          'There is no single price for an estate cleanout. Clearing one bedroom might cost a few hundred dollars, while a full house with a garage, basement and decades of belongings can run into the thousands. The good news: once you know what companies look at, quotes become much easier to compare.',
        ],
        heading: 'The short answer',
      },
      {
        heading: 'What drives the price',
        bullets: [
          'Volume. Most companies think in truckloads. The more there is to remove, the more it costs.',
          'Size and layout of the home. Stairs, basements, attics, long walks to the truck and tight access all add labor.',
          'What happens to the items. Sorting for donation, recycling and resale takes more time than hauling everything to the landfill, but it is often worth it.',
          'Special items. Pianos, hot tubs, safes, appliances, paint, chemicals and other hazardous materials usually cost extra.',
          'Condition of the home. Hoarding situations, pest problems or water damage need more crew and protective equipment.',
          'Timeline. A rush job (for example, a house closing next week) can cost more than a flexible one.',
        ],
      },
      {
        heading: 'How companies quote',
        paragraphs: [
          'Most estate cleanout companies give a flat project price after a walkthrough, in person or by video. Junk removal companies more often price by the truckload or a fraction of one. Some charge hourly for labor plus disposal fees. A flat, written quote is the easiest to compare and protects you from surprises.',
        ],
      },
      {
        heading: 'What a good quote includes',
        bullets: [
          'Exactly which rooms and areas are included (garage, shed, attic, basement).',
          'What is donated, recycled, sold or thrown away, and whether you get donation receipts.',
          'Disposal and dump fees, and any extra charges for special items.',
          'Whether the home is left broom-clean.',
          'The start date, how many days it will take, and when payment is due.',
        ],
      },
      {
        heading: 'Ways to lower the cost',
        bullets: [
          'Take what the family wants first, including photos, papers and keepsakes.',
          'Sell anything valuable before the cleanout. An estate sale or buyout can offset some or all of the cleanout cost.',
          'Ask whether the company buys items or credits resale value against the price.',
          'Get two or three quotes. Prices for the same house can differ a lot.',
          'Be flexible on timing if you can.',
        ],
      },
    ],
  },
  {
    slug: 'choose-estate-cleanout-company',
    title: 'How to Choose an Estate Cleanout Company',
    description:
      'A checklist for hiring an estate cleanout company: insurance, written quotes, what happens to belongings, and the questions to ask before you sign.',
    summary: 'A simple checklist and the questions to ask before you hire anyone.',
    readMinutes: 4,
    serviceSlug: 'estate-cleanouts',
    serviceCta: 'Find estate cleanout companies near you',
    sections: [
      {
        heading: 'Why it matters',
        paragraphs: [
          'A cleanout crew will be alone in a home full of a family’s belongings, often while the family lives far away. Choosing a careful, honest company protects valuables, important papers and your peace of mind.',
        ],
      },
      {
        heading: 'Checklist',
        bullets: [
          'Insured. Ask for proof of liability insurance, and workers’ compensation if they have employees. Bonded is a plus.',
          'Walkthrough and written quote. A company that quotes a whole house without seeing it, in person or on video, is guessing.',
          'Clear plan for belongings. Ask where items go: donation, recycling, resale or landfill.',
          'Care with papers and valuables. A good crew watches for cash, jewelry, photos, wills, deeds and financial documents, and sets them aside for you.',
          'Reviews and references. Look for recent reviews, and ask for a reference from a similar job.',
          'Fair payment terms. A deposit is normal. Paying everything up front is not.',
          'Good communication. If you can’t be there, ask for photo or video updates.',
        ],
      },
      {
        heading: 'Questions to ask',
        bullets: [
          'What exactly is included in the price, and what would cost extra?',
          'Do you donate items, and will I get a receipt for taxes?',
          'What do you do if you find valuables or personal papers?',
          'How many people will be on the crew, and how long will it take?',
          'Will the home be broom-clean when you’re done?',
          'Can you also handle an estate sale, a buyout or junk removal, or recommend someone who does?',
        ],
      },
      {
        heading: 'Red flags',
        bullets: [
          'No proof of insurance.',
          'Cash only, or full payment before any work.',
          'A price that changes on the day of the job.',
          'Pressure to decide on the spot.',
        ],
      },
    ],
  },
  {
    slug: 'estate-cleanout-vs-estate-sale',
    title: 'Estate Cleanout vs. Estate Sale: Which Do You Need?',
    description:
      'The difference between an estate sale and an estate cleanout, when each makes sense, and why many families use both, in the right order.',
    summary: 'What each one does, when to use which, and why many families use both.',
    readMinutes: 3,
    serviceSlug: 'estate-sales',
    serviceCta: 'Compare estate sale companies',
    sections: [
      {
        heading: 'The difference',
        paragraphs: [
          'An estate sale turns belongings into money: a company prices the contents of the home and runs a public sale, usually over a few days, and keeps a percentage of what sells. An estate cleanout empties the home: a crew removes what is left, donating, recycling or disposing of it, and you pay for the service.',
        ],
      },
      {
        heading: 'An estate sale makes sense when',
        bullets: [
          'The home has furniture, collectibles, tools, jewelry or other items with real resale value.',
          'You have a few weeks before the home needs to be empty.',
          'You want the contents to help pay estate costs.',
        ],
      },
      {
        heading: 'A cleanout makes sense when',
        bullets: [
          'The contents have little resale value.',
          'The house needs to be empty quickly, for example for a sale or a lease ending.',
          'An estate sale has already happened and items are left over.',
        ],
      },
      {
        heading: 'Using both',
        paragraphs: [
          'Many families do both, in this order: the family takes what it wants, an estate sale company sells what has value, and a cleanout crew clears the rest. Some companies offer all of this, or will buy the remaining contents outright. If a parent is moving to a smaller home or senior living rather than an estate being settled, a senior move manager can plan the move, downsizing and sale together.',
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string | undefined): Guide | null {
  return GUIDES.find((g) => g.slug === slug) || null;
}

export function guidePath(slug: string): string {
  return `/guides/${slug}`;
}

// Parses /guides/:slug. Returns null for anything else.
export function parseGuidePath(pathname: string): Guide | null {
  const match = pathname.replace(/\/+$/, '').match(/^\/guides\/([^/]+)$/);
  return match ? guideBySlug(match[1]) : null;
}
