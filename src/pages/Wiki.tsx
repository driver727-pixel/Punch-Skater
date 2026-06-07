import { useState, useMemo } from "react";

interface WikiSection {
  id: string;
  title: string;
  content: string;
  subsections?: WikiSubsection[];
}

interface WikiSubsection {
  id: string;
  title: string;
  content: string;
}

const WIKI_SECTIONS: WikiSection[] = [
  {
    id: "world-overview",
    title: "World Overview",
    content: `The world of Punch Skater™ is a cyberpunk courier underground built beneath the United Corporate Alliance (UCA) control. Suspended above Greater Western Sydney is Airaway, a polished sky-city where executives live in chrome towers while the basin below chokes on industrial smog. Below sprawls the real city: courier underworld built from decayed roads, repurposed tunnels, and off-grid settlements.

In this world, networks are poison. Data gets hacked, altered, and intercepted. So trust moved back into flesh and motion: hand-carried drives, live couriers, real risk. That is why the Skater Courier became the most valuable labor class in the city—and why everyone hunts them.`,
    subsections: [
      {
        id: "transit-doctrine",
        title: "Transit Doctrine",
        content: `Esk8 (electric skateboards) are the dominant transport system. They are cheaper than flying cars, better suited to failing infrastructure, and harder to lock down than conventional vehicles. The most valuable runner in the city is the Skater Courier: a person carrying critical data, contraband, medicine, or relics by hand.

Data on a thumb drive beats data on a server. Digital networks are too easy to hack, intercept, poison, or surveil. Physical delivery is trust.`,
      },
      {
        id: "australian-joust",
        title: "Australian Jousting Doctrine",
        content: `Punch Skater™s did not evolve around firearms as standard weapons. Guns exist, but they are treated as extreme-circumstance tools rather than everyday kit.

Australian Punch Skater™s instead evolved around jousting on Esk8. They fight, perform, and settle prize disputes with cyber lances and shields. Jousting is battle doctrine, street spectacle, and prize fighting culture all at once.`,
      },
      {
        id: "the-code",
        title: "The Code",
        content: `- Esk8 or die — motorized vehicles are relics.
- Never open the package.
- UCA white bikes are enemy symbols — broomstick first.
- The Nightshade belongs to the crews. Outsiders skate at their own risk.
- Scratch talks; corps walk.
- Airaway is not for you — unless you've got a contractor pass or nerve.
- Data on a thumb drive beats data on a server.
- Australian Punch Skater™s do not rely on firearms except in extreme circumstances — cyber lances and shields define battle, entertainment, and prize fighting.
- A Punch Skater™ owes nothing to nobody. Until they owe everything.`,
      },
    ],
  },
  {
    id: "districts",
    title: "Districts & Locations",
    content: `The City spans multiple interconnected districts, each with its own culture, control structure, and role in the courier economy.`,
    subsections: [
      {
        id: "airaway",
        title: "Airaway",
        content: `Control: United Corporate Alliance (UCA)
Australian analogue: Blue Mountains sky-city above Greater Western Sydney
Atmosphere: Blue Mountains cold air, polished steel, pressurised walkways, automated maintenance drones, basin smog below.
Known crews: Chrome Blades, Phantom Riders
Tagline: "The higher you go, the colder the air. The colder the air, the cleaner the money."

The corporate penthouse of the setting. Airaway is all glass, chrome, contractor badges, and biometric checkpoints. Punch Skater™s are explicitly outlawed here.`,
      },
      {
        id: "batteryville",
        title: "Batteryville",
        content: `Control: HexChain Logistics / Recycler Collectives
Australian analogue: Port Kembla steelworks with Pilbara ore lines
Atmosphere: Industrial, loud, ozone-tinged air, steelworks glare, Pilbara freight lines, three-dimensional rail scaffolding.
Known crews: Iron Circuit, Voltage Saints, Circuit Breakers
Tagline: "The City runs on our power. We run on spite."

The engine room of the City. Batteryville is bulk cargo, rail switchways, refinery heat, and the district that turns exhausted workers into brutal long-haul couriers. Stamina matters more than glamour here.`,
      },
      {
        id: "the-grid",
        title: "The Grid",
        content: `Control: Cascade Technologies
Australian analogue: Canberra surveillance precinct
Atmosphere: Sterile, grid-pattern streets, omnipresent sensor arrays, federal order, scrolling diagnostic readouts.
Known crews: The Static Pack, Phantom Riders
Tagline: "Information wants to be free. The Grid decides the price."

The most surveilled district in the City. Physical chips move here because the network itself cannot be trusted. The Grid swallows worker histories, courier aliases, and inconvenient family records; it should feel like a place where personal trails disappear into systems.`,
      },
      {
        id: "nightshade",
        title: "Nightshade",
        content: `Control: Courier crews — no single corp holds it
Australian analogue: Melbourne laneways / Fitzroy basement scene
Atmosphere: Perpetual neon twilight, Melbourne-style laneways, blacklight murals, underground raves, loyal crews.
Known crews: Nightshade Runners, The Undercurrent, Neon Ghosts, The Dark Lanes, Moonrisers
Tagline: "Nobody owns Nightshade. Nightshade owns you."

The underground's birthplace. Every courier network traces itself back to a Nightshade deal, rave, betrayal, or rescue. This is where unknown riders become signals and multiple faction lines begin to cross.`,
      },
      {
        id: "glass-city",
        title: "Glass City",
        content: `Control: Prism Media Group / Autonomous Systems
Australian analogue: Perth CBD on the Swan River
Atmosphere: Rain-soaked neon reflections, Swan River glass towers, holographic ads, silent drone traffic, no humans in sight.
Known crews: Neon Ghosts, The Static Pack, Phantom Riders
Tagline: "A million screens. Zero witnesses."

The City's empty spectacle district. Everything glows, everything records, and almost nobody is physically present. Human couriers only work here when the autonomous network is not allowed to touch the package.`,
      },
      {
        id: "the-forest",
        title: "The Forest",
        content: `Control: The Wooders — self-governed agrarian commune
Australian analogue: Daintree canopy settlements / Nimbin communes
Atmosphere: Forest canopy, wooden structures, rope bridges, birdsong and wind, Daintree humidity, no holo-displays.
Known crews: The Wooders
Tagline: "Build with wood. Grind with wood. Live without the grid."

An off-grid settlement built from carved trunks, rope bridges, and hard-earned suspicion. The Wooders trust wooden decks, manual craft, and very little else.`,
      },
      {
        id: "the-roads",
        title: "The Roads",
        content: `Control: Open courier territory / relay camps
Australian analogue: Nullarbor Plain / Stuart Highway
Atmosphere: Cracked asphalt, faded lane markings, open sky, Nullarbor wind, endless straightaways.
Known crews: Road Runners, Asphalt Angels
Tagline: "Transit is its own battlefield."

The Roads are where route events, ambushes, weather disasters, and long-haul courier drama erupt between destinations. They are a corridor gameplay layer rather than a normal mission hub or civic district, but operate as district-equivalent for operations purposes.`,
      },
      {
        id: "electropolis",
        title: "Electropolis (Hidden)",
        content: `Status: Hidden / future playable reveal
Control: City Security — the Fuzz
Australian analogue: Brisbane CBD / Gold Coast surveillance strip
Tagline: "Move along. Designated transit corridors only."

Electropolis is still part of the canon, but intentionally withheld from the main district grid. It exists as a clean-looking security showcase where the Fuzz tolerates skaters only inside designated corridors.`,
      },
    ],
  },
  {
    id: "archetypes",
    title: "Courier Archetypes",
    content: `The live forge uses ten courier archetypes. Each one carries a worldview, a stat identity, and a role in the City's conflict web. They function like schools, factions, or professional lineages.`,
    subsections: [
      {
        id: "knights-technarchy",
        title: "The Knights Technarchy",
        content: `Tagline: "The Dark Lights see everything. Serve or be disappeared."

Cyber ninja zealots serving the secretive Dark Lights. They move sacred packages between hidden temples and build their reputation through fear and precision.

Strengths: Maximum Stealth, elite Speed. Excels in surveillance-heavy districts. Penalty: low Rep.`,
      },
      {
        id: "quills",
        title: "Qu111s (Quills)",
        content: `Tagline: "The truth is in the data. We will release it."

A guerrilla journalist network protecting volatile proof-carriers while preparing a truth dump big enough to destabilize the UCA.

Strengths: Maximum Rep, high Grit. Thrives in Nightshade and open districts. Penalty: low Stealth.`,
      },
      {
        id: "iron-curtains",
        title: "Iron Curtains",
        content: `Tagline: "Overthrow the oligarchy. By any means necessary."

A revolutionary front trafficking in weapons and leverage. Their myth, rhetoric, and recruitment pool matter more in public than their actual command structure.

Strengths: High Grit, balanced stats. Adaptable across all districts. Steady performers over specialists.`,
      },
      {
        id: "neon-legion",
        title: "Ne0n Legion",
        content: `Tagline: "Information is a commodity. We are the market."

Thieves and mercenaries who treat every run as a profit opportunity. They move like couriers and think like opportunists.

Strengths: High Speed, strong Stealth, opportunistic Tech. Excels on smash-and-grab runs through neon districts.`,
      },
      {
        id: "dark-spider",
        title: "D4rk $pider",
        content: `Tagline: "Data for blackmail. Blackmail for survival."

Dark-web operators using courier lanes for blackmail, scams, and survival. Their exact backers remain deliberately unclear.

Strengths: Maximum Tech, strong Stealth. The Grid is their natural habitat.`,
      },
      {
        id: "asclepians",
        title: "The Asclepians",
        content: `Tagline: "Medicine moves. People live. No questions asked."

Medical couriers and humanitarian smugglers moving medicine, organs, and restricted care through hostile territory. They can hide high-risk medical cargo behind clean courier profiles when the route needs plausible cover.

Strengths: Good Speed, high Grit, strong community access. Thrives in Batteryville and Nightshade.`,
      },
      {
        id: "mesopotamian-society",
        title: "The Mesopotamian Society",
        content: `Tagline: "Indiana Jones on an electric mountain skateboard."

Artifact couriers and academic treasure hunters moving relics for museums, collectors, and dangerous patrons. They are one of the quiet connectors between elite collecting culture and cult pressure.

Strengths: Maximum Rep, high Tech. Elite access to high-security archives. Penalty: limited Stealth.`,
      },
      {
        id: "hermes-squirmies",
        title: "Hermes' Squirmies",
        content: `Tagline: "Any job. Any package. Any risk. Price adjusted accordingly."

A neutral courier union whose entire value proposition is secrecy without ideology. If the job is real, they'll price it.

Strengths: Balanced stats. Neutral reputation. Works across all districts without faction penalties.`,
      },
      {
        id: "ucps",
        title: "UCPS Workers",
        content: `Tagline: "Sanctioned delivery. Corporate rates. No questions."

The official board-riding postal workforce of Airaway. UCPS roles double as some of the best cover identities in the setting.

Strengths: Good Speed, solid Rep. Moves through corp-controlled districts with reduced scrutiny.`,
      },
      {
        id: "the-team",
        title: "The Team",
        content: `Tagline: "Coordination wins races. Coordination wins everything."

A neutral collective of ex-athletes whose synchronized operations make them competitive with the City's biggest powers. They present as sponsor-friendly performers rather than ideological operators.

Strengths: High Speed, high Grit. Exceptional in team-based operations. Strong Rep through visible performance.`,
      },
    ],
  },
  {
    id: "factions",
    title: "Major Power Blocs & Factions",
    content: `The City's power structure is fragmented across multiple competing factions. No single entity controls everything; instead, the world is shaped by tensions between UCA corporate interests and underground resistance movements.`,
    subsections: [
      {
        id: "united-corporate-alliance",
        title: "United Corporate Alliance (UCA)",
        content: `Districts: Airaway
Tagline: "Infrastructure, security, compliance. In that order."

The dominant governing consortium. Their identical white bikes make perfect symbols of sanctioned transit, which is exactly why Punch Skater™s target them.`,
      },
      {
        id: "qu111s-faction",
        title: "Qu111s (Quills)",
        content: `Districts: Nightshade
Tagline: "The truth is in the data. We will release it."

A guerrilla journalist organization trying to expose the UCA. They protect couriers when those riders become useful carriers of volatile truth. Part of their endgame is proving the Iron Curtains are a false flag.`,
      },
      {
        id: "neon-legion-faction",
        title: "Ne0n Legion",
        content: `Districts: Nightshade, The Grid
Tagline: "Information is a commodity. We are the market."

Thieves and mercenaries who sell leverage to whoever can pay.`,
      },
      {
        id: "iron-curtains-faction",
        title: "Iron Curtains",
        content: `Districts: The Grid, Batteryville
Tagline: "Overthrow the oligarchy. By any means necessary."

A revolutionary front that markets itself as the answer to oligarch control. The public myth matters because disaffected riders need to believe it. However, the UCA covertly manipulates the group as a false-flag containment arm.`,
      },
      {
        id: "dark-spider-faction",
        title: "D4rk $pider",
        content: `Districts: The Grid, Nightshade
Tagline: "Data for blackmail. Blackmail for survival."

Hackers and survivalists using information as extortion, fraud, and leverage. Their exact funding model should stay unresolved unless a later story needs to pin it down.`,
      },
      {
        id: "asclepians-faction",
        title: "The Asclepians",
        content: `Districts: Airaway, Batteryville, Nightshade
Tagline: "Medicine moves. People live. No questions asked."

Medical-humanitarian couriers operating across class lines, sometimes nobly and sometimes for wealthy patrons. They are one of the most believable covers for moving a protagonist through hostile territory.`,
      },
      {
        id: "mesopotamian-faction",
        title: "The Mesopotamian Society",
        content: `Districts: Nightshade, Airaway
Tagline: "Indiana Jones on an electric mountain skateboard."

Artifact couriers whose work pulls relics through museums, mansions, and hidden cult territory. They connect elite collectors, academic legitimacy, and cult attention.`,
      },
      {
        id: "knights-faction",
        title: "The Knights Technarchy",
        content: `Districts: Nightshade, Airaway
Tagline: "The Dark Lights see everything. Serve or be disappeared."

Dark Lights zealots moving sacred packages. They exist as organized cult pressure, not just aesthetic ninja menace.`,
      },
      {
        id: "hermes-faction",
        title: "Hermes' Squirmies",
        content: `Districts: The Roads, Batteryville, Nightshade
Tagline: "Any job. Any package. Any risk. Price adjusted accordingly."

The neutral labor line of the courier world. They stay relevant by refusing ideology.`,
      },
      {
        id: "ucps-faction",
        title: "UCPS Workers",
        content: `Districts: Airaway, The Roads
Tagline: "Sanctioned delivery. Corporate rates. No questions."

The official postal workers who make excellent cover for anyone needing checkpoint access.`,
      },
      {
        id: "moonrisers",
        title: "Moonrisers",
        content: `Districts: Nightshade, Batteryville
Tagline: "The capitalist pigs will fall. We just need the right spark."

Underground agitators and rave organizers who turn overlooked riders into bigger currents. They are the spark, not the whole engine.`,
      },
      {
        id: "wooders",
        title: "The Wooders",
        content: `Districts: The Forest
Tagline: "Build with wood. Grind with wood. Live without the grid."

A self-governed off-grid commune whose distrust of corporate technology is total.`,
      },
      {
        id: "punch-skaters",
        title: "Punch Skater™s",
        content: `Districts: Nightshade, The Roads, Batteryville
Tagline: "We are the lowest rung. And we are everywhere."

The bruised, bloodied gutter-punk baseline of the whole setting. Everyone knows them. Nobody respects them. They keep coming anyway.`,
      },
      {
        id: "the-team-faction",
        title: "The Team",
        content: `Districts: Glass City, Airaway
Tagline: "Coordination wins races. Coordination wins everything."

A precision collective of ex-athletes who look sponsor-friendly enough to vanish into corporate branding. Keep The Team explicit anywhere the setting lists its major live power blocs, even though they present as polished operators instead of a classic faction.`,
      },
    ],
  },
  {
    id: "rivals",
    title: "Named District Rivals",
    content: `The first wave of named district rivals. Each rival owns a boss-tier joust card, a signature tactic, a card reward, and a Codex unlock.`,
    subsections: [
      {
        id: "jax-voltage",
        title: "Jax Voltage — Batteryville",
        content: `Faction: Iron Curtains
Signature tactic: Boost (Boost Charge)
Tagline: "Send it, mate. Last one breathing wins."

Personality: Loud, grinning, allergic to caution. Grew up on the Pilbara freight scaffolds and treats every joust like the rail line is closing in five seconds.

Card reward: Voltage Relay — Rare Iron Curtains lance carrying Boost Charge.
Codex unlock: Jax Voltage: Breaker-Yard Bolt.`,
      },
      {
        id: "mina-chrome",
        title: "Mina Chrome — Airaway",
        content: `Faction: United Corporate Alliance (UCA)
Signature tactic: Guard (Magnetic Guard)
Tagline: "Compliance check. Hold the line, mate, and try not to break it."

Personality: Polite, polished, absolutely lethal. Runs the Airaway checkpoints like a board meeting and quotes the contractor handbook between passes.

Card reward: Chrome Aegis — Legendary magnetised executive shield carrying Magnetic Guard.
Codex unlock: Mina Chrome: Glass-Lane Marshal.`,
      },
      {
        id: "rook-wraith",
        title: "Rook Wraith — Nightshade",
        content: `Faction: Ne0n Legion
Signature tactic: Feint (Neon Flourish)
Tagline: "You don't see the lane till I want you to. Dodgy as."

Personality: Quiet, unsmiling, allergic to spotlights. Knows every Melbourne laneway the city forgot to map and treats them like personal property.

Card reward: Wraith Shortcut — Rare Ne0n Legion deck etched with a laneway map.
Codex unlock: Rook Wraith: Laneway Ghost.`,
      },
      {
        id: "vex-static",
        title: "Vex Static — The Grid",
        content: `Faction: D4rk $pider
Signature tactic: Counter (Street Parry)
Tagline: "Cameras are mine for the next ninety seconds. Have a crack."

Personality: Calm, sarcastic, almost never blinks. Treats every joust as a data problem and runs counter-traces on the surveillance net to make the lane forget the joust briefly happened.

Card reward: Static Trace — Legendary D4rk $pider beacon, a bricked Cascade trace left behind as a receipt.
Codex unlock: Vex Static: Lane in the Static.`,
      },
      {
        id: "nova-saint",
        title: "Nova Saint — Glass City",
        content: `Faction: The Team
Signature tactic: Trick Strike (Neon Flourish)
Tagline: "Big crowd tonight. Showpony for the screens, mate?"

Personality: Warm on camera, ruthless off it. Performs every joust for the Swan River holo-ads and pulls the most-replayed Trick Strike clip in the feed.

Card reward: Saint Spotlight — Legendary signed sponsor banner that doubles as a hype shield.
Codex unlock: Nova Saint: Highlight Reel.`,
      },
    ],
  },
];

export function Wiki() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSections(newSet);
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return WIKI_SECTIONS;
    }

    const query = searchQuery.toLowerCase();
    return WIKI_SECTIONS.map((section) => {
      const titleMatch = section.title.toLowerCase().includes(query);
      const contentMatch = section.content.toLowerCase().includes(query);

      const filteredSubsections = section.subsections
        ?.filter(
          (sub) =>
            sub.title.toLowerCase().includes(query) ||
            sub.content.toLowerCase().includes(query)
        )
        .map((sub) => ({
          ...sub,
          titleMatch: sub.title.toLowerCase().includes(query),
          contentMatch: sub.content.toLowerCase().includes(query),
        }))
        .sort((a, b) => Number(b.titleMatch) - Number(a.titleMatch));

      if (titleMatch || contentMatch || (filteredSubsections && filteredSubsections.length > 0)) {
        return {
          ...section,
          subsections: filteredSubsections,
        };
      }
      return null;
    }).filter(Boolean) as typeof WIKI_SECTIONS;
  }, [searchQuery]);

  const resultCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return filteredSections.reduce(
      (count, section) => count + 1 + (section.subsections?.length ?? 0),
      0
    );
  }, [filteredSections, searchQuery]);

  return (
    <div className="page wiki-page">
      <h1 className="page-title">Punch Skater™ Wiki</h1>
      <p className="page-sub">Comprehensive lore reference for the world, factions, districts, and rivals of Punch Skater™.</p>

      {/* Search Box */}
      <div className="wiki-search-container">
        <input
          type="text"
          className="wiki-search-input"
          placeholder="Search lore, districts, factions, archetypes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search wiki content"
        />
        {searchQuery.trim() && (
          <div className="wiki-search-results-info">
            Found {resultCount} {resultCount === 1 ? "result" : "results"}
          </div>
        )}
      </div>

      {/* Wiki Content */}
      {filteredSections.length === 0 ? (
        <div className="wiki-no-results">
          <p>No results found for "{searchQuery}"</p>
          <button
            className="btn-outline btn-sm"
            onClick={() => {
              setSearchQuery("");
              setExpandedSections(new Set());
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="wiki-sections">
          {filteredSections.map((section) => (
            <section key={section.id} className="wiki-section">
              <button
                className="wiki-section-header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={expandedSections.has(section.id)}
              >
                <span className="wiki-section-title">{section.title}</span>
                <span className="wiki-section-toggle">{expandedSections.has(section.id) ? "−" : "+"}</span>
              </button>

              {expandedSections.has(section.id) && (
                <div className="wiki-section-content">
                  <p className="wiki-body">{section.content}</p>

                  {section.subsections && section.subsections.length > 0 && (
                    <div className="wiki-subsections">
                      {section.subsections.map((subsection) => (
                        <div key={subsection.id} className="wiki-subsection">
                          <h4 className="wiki-subsection-title">{subsection.title}</h4>
                          <p className="wiki-body">{subsection.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
