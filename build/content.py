# -*- coding: utf-8 -*-
"""All editable site content for M2D. Edit here, then run:  python3 build/build.py"""

SITE = dict(
    name="M2D Interior Design & Consultancy",
    short="M2D",
    phone="+65 9822 1113",
    phone_raw="6598221113",
    email="enquire@m2decor.com.sg",
    address="38 Woodlands Industrial Park E1, #05-12, Singapore 757700",
    instagram="https://www.instagram.com/m2dinterior/",
    facebook="https://www.facebook.com/M2DECORPTELTD",
    tiktok="https://www.tiktok.com/@m2decor",
    youtube="https://www.youtube.com/@M2Decor",
    google_reviews="https://www.google.com/maps/place/M2+Decor+Pte+Ltd/@1.454737,103.7983522,17z/data=!4m6!3m5!1s0x31da139a0f66d853:0xc810eab93ec98c2e!8m2!3d1.454737!4d103.7983522!16s%2Fg%2F11g0kfmnjb",
    benjamin_link="#",            # Benjamin's personal brand — add URL when ready
)

NAV = [("Home","index.html"),("About us","about.html"),("Services","services.html"),("Portfolio","portfolio.html"),("Blog","blog.html"),("Contact us","contact.html")]

# "Working with" marquee. Replace `img` with a logo path (assets/img/partners/xxx.png) when you have the files.
PARTNERS = [
    dict(name="HDB", sub="Licensed Renovation Contractor"),
    dict(name="BCA", sub="Registered Contractor"),
    dict(name="CaseTrust", sub="Accredited Renovation Firm"),
    dict(name="RCMA", sub="Accredited Member"),
    dict(name="Google", sub="Reviews"),
    dict(name="HomeTrust", sub="Verified Reviews"),
    dict(name="Qanvast", sub="Featured Firm"),
    dict(name="Facebook", sub="Recommended"),
]

STATS = [("35","Years of craftsmanship","+"),("300","Spaces renovated","+"),("200","Happy customers","+")]

SERVICES = [
    dict(n="01", title="Interior Design", img="assets/img/hozon/01.jpg",
         text="We implement interior design for homes of all sizes. With competent planning, even a compact HDB or condo can be significantly expanded, modernised and visually enlarged, giving it more usable space. We design around how you actually live: the morning routine, the hosting, the quiet evenings."),
    dict(n="02", title="Turnkey Renovation", img="assets/img/home/06.jpg",
         text="A well-established system of managing all stages of work makes it possible to meet deadlines and complete the renovation without you on site. We visit, monitor the match between the design project and the actual build, and control the finish against the agreed colour scheme and materials."),
    dict(n="03", title="In-house Carpentry", img="assets/img/home/05.jpg",
         text="Our roots lie in the art of woodwork. Carpentry, ceiling and partition works, electrical and simple masonry are handled by our own crew, not subcontracted. Choosing materials with a specialist means you buy stylistically justified, functional pieces that belong in the overall picture of your home."),
]

PROJECTS = [
    dict(slug="hotel-at-home", name="Hotel at Home", place="Anchorvale", year="2023", type="Residential · 1-Room BTO",
         area="640 sqft · 56 sqm", rooms="1 Room · 1 Bath", folder="hotel", cover="assets/img/hotel/05.jpg", portrait="assets/img/hotel/04.jpg",
         tagline="Full-height backsplash, made for the bold, daring people who have seen everything and are constantly looking for new experiences and elevation.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Building & construction","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","Benjamin Toh Jun Jie")],
         paras=["When you have a small bathroom, elevation is important. The layout and colour scheme used is a combination of natural and light materials and an extravagant colour palette to make your heart beat again and again.",
                "Custom-made walnut flute wall panels frame the walls of the bedroom and living area, creating the illusion of a home with grandeur and further enhancing our design theme.",
                "Using furnishing as the focal point, a large LED TV and a white curved soft-suede sofa were selected to give an inviting, stylish lounge look, at the same time diverting attention from the space's diminutive size."],
         gallery=["05","02","04","01","03"]),
    dict(slug="japandi-spirit", name="Japandi Spirit", place="25 Rosewood Drive", year="2022", type="Residential · HDB",
         area="1000 sqft · 93 sqm", rooms="2 Rooms · 2 Baths", folder="japandi", cover="assets/img/japandi/07.jpg", portrait="assets/img/japandi/01.jpg",
         tagline="A sleek, minimalistic, wabi-sabi interior of Scandinavian and Japanese design. This home is a visual storyboard of consciously layered earthy colours and natural materials, without forgoing functionality.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Building & construction","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","Benjamin Toh Jun Jie")],
         paras=["The communal space works equally well for one person or a group of up to ten. The client loves to host friends and family, so a built-in settee was cleverly designed into the dining zone.",
                "Light oak, soft linen and warm white paint do the heavy lifting. Every surface was chosen to age gracefully and to let the natural light from the full-width windows carry the room."],
         gallery=["07","02","03","01","05","04","06"]),
    dict(slug="embrace-serenity", name="Embrace Serenity", place="201B Woodleigh Link", year="2023", type="Residential · HDB",
         area="969 sqft · 90 sqm", rooms="3 Bedrooms", folder="serenity", cover="assets/img/serenity/06.jpg", portrait="assets/img/serenity/01.jpg",
         tagline="Creating an 'undesigned', warm and comforting space that feels like a home rather than an apartment.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","Benjamin Toh & Naqib Yusop")],
         paras=["Based on our client's wishes, it was clear throughout the process that we would use organic and dark materials. The curved walls, in contrast to mid-toned wood, plants and art, make this place feel like a unique home, not a showroom.",
                "Immerse yourself in a cosy kitchen where shades of green, brown and black intertwine with the soothing essence of nature. The interplay of light and dark, inspired by the natural world, creates an inviting atmosphere that exudes tranquillity and sophistication.",
                "Drawing inspiration from the allure of darkness, we crafted a luxurious foundation as the canvas for this project. Rich browns, deep greens, warm greys and muted tans come together harmoniously, enveloping you in a cocoon of comfort."],
         gallery=["06","02","01","04","07","05","03"]),
    dict(slug="hozon", name="Hozon", place="120B Rivervale Drive", year="2023", type="Residential · HDB",
         area="1400 sqft · 130 sqm", rooms="4 Rooms · 2 Baths", folder="hozon", cover="assets/img/hozon/01.jpg", portrait="assets/img/hozon/05.jpg",
         tagline="Minimalism does not mean 'nothing'. Uncluttered minimalism celebrates the elegance found in simplicity, creating environments that please the eye and provide respite from the chaos of the modern world.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","Benjamin Toh & Naqib Yusop")],
         paras=["Based on our client's wishes, we used light colours to evoke understated minimalism and elegance through the furnishings. Natural light plays a pivotal role, enhancing the openness of the space and creating a seamless connection between the interior and its surroundings.",
                "This design ethos extends beyond the physical, influencing lifestyle choices and fostering a mindset of intentional living. Stripping away excess embellishment embraces 'less is more', creating spaces that exude tranquillity and clarity.",
                "Even the bathroom was not spared. Thoughtful organisation, clean lines and storage solutions ensure that each item has its designated place, promoting both order and efficiency."],
         gallery=["01","02","03","06","05","04","09","07","10","08"]),
    dict(slug="urban-fusion", name="Urban Fusion", place="6 Pari Dedap Walk", year="2026", type="Residential · Semi-industrial",
         area="1040 sqft · 97 sqm", rooms="3 Rooms · 2 Baths", folder="urban", cover="assets/img/urban/04.jpg", portrait="assets/img/urban/06.jpg",
         tagline="Semi-industrial design captures the essence of urban chic by blending raw, industrial elements with a touch of warmth and sophistication.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","Benjamin Toh Jun Jie")],
         paras=["Our client wanted a semi-industrial design that incorporates organic furnishings and soft textures to balance the rugged elements. Plush sofas, cosy rugs and strategically placed textiles create inviting spaces within the raw backdrop.",
                "A palette of greys, whites and muted earthy hues lets the industrial elements stand out while providing a canvas for personal touches. Reclaimed wood, metal and factory-inspired lighting add character and a touch of history.",
                "The industrial aesthetic was kept to the wall and floor finishes. The bathroom, the highest-traffic space, keeps practicality as the key: no hanging elements, no reclaimed wood or metal, just neutral tones that let the vibe stand out."],
         gallery=["04","01","06","07","09","03","02","08","05","10"]),
    dict(slug="chaseki", name="Chaseki", place="Hillview Rise", year="2024", type="Residential · Condominium",
         area="546 sqft · 50 sqm", rooms="1 Room + 1 Study · 1 Bath", folder="chaseki", cover="assets/img/chaseki/09.jpg", portrait="assets/img/chaseki/06.jpg",
         tagline="A sophisticated and inviting ambience in light beige. Soft curves and gentle lines define the furniture and architecture, contributing to an overall sense of fluidity and harmony.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","Benjamin Toh Jun Jie")],
         paras=["Our client wanted a theme that reflects calm and peace without any visual noise. Natural light floods the room through gracefully draped windows, enhancing the softness of the beige tones; light upholstery and plush throws add layers of cosiness.",
                "In the main living space, streamlined furniture with built-in storage keeps personal items out of sight. Concealed doors maintain the seamless look and, when opened, reveal private retreats that continue the design language.",
                "The study's feature wall is adorned with concave panels for texture and dimension, while the bathroom's panelling is designed to exude elegance, sophistication and comfort, a harmonious blend of function and opulence."],
         gallery=["09","01","03","05","02","07","06","04","08"]),
    # ---- added from Benjamin's Drive (Nov 2026). Names, taglines and copy are drafts for Benjamin to confirm; area/rooms marked TBC where unknown.
    dict(slug="oak-and-ember", name="Oak & Ember", place="1C Cantonment Road", year="2024", type="Residential · 5-Room HDB",
         area="TBC", rooms="5-Room · 2 Baths", folder="cantonment", cover="assets/img/cantonment/01.jpg", portrait="assets/img/cantonment/04.jpg",
         tagline="Light oak, fluted panels and a city view at dusk. A warm, uncluttered home where every wall earns its place.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","M2D Interior")],
         paras=["A continuous run of oak-toned carpentry ties the living, dining and entrance into one calm surface. The TV wall sits inside it, framed in a soft textured panel with lit display shelving to one side.",
                "At night the cove lighting takes over: a thin warm line along the ceiling, backlit shelves, and the city skyline through full-height blinds. Fluted panels soften the bedroom headboard wall and hide the wardrobe doors.",
                "The kitchen and bathroom stay quiet in pale stone and white, so the oak carries the whole home."],
         gallery=["01","02","03","04","05","06","07","08","09","10","11","12"]),
    dict(slug="fu", name="Fú", place="27 West Coast", year="2026", type="Residential · Condominium",
         area="TBC", rooms="TBC", folder="westcoast", cover="assets/img/westcoast/01.jpg", portrait="assets/img/westcoast/11.jpg",
         tagline="A single character of calligraphy, two road bikes on a pegboard wall, and a curved sofa to come home to.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","M2D Interior")],
         paras=["The brief was a home that could hold the owners' two passions in one open room: the bikes and the dinner table. A full-height pegboard wall hangs the bicycles like art, facing a long stone dining table under a soft fabric ceiling fan.",
                "A single 福 scroll anchors the sideboard, and the palette stays to warm greys, pale timber and cream boucle so nothing competes with it.",
                "The kitchen runs flush behind sliding panels; the bathrooms are wrapped in travertine-look porcelain with a lit niche and rain shower."],
         gallery=["01","02","03","04","05","06","07","08","09","10","11","12"]),
    dict(slug="nimbus", name="Nimbus", place="443 Punggol", year="2025", type="Residential · 4-Room HDB BTO",
         area="TBC", rooms="4-Room · 2 Baths", folder="punggol", cover="assets/img/punggol/01.jpg", portrait="assets/img/punggol/10.jpg",
         tagline="Soft curves, a timber slat screen and a sofa like a cloud. A home designed to lower your shoulders the moment you walk in.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","M2D Interior")],
         paras=["A vertical timber slat screen divides the entrance from the living room without closing it off, letting light pass through and giving the entryway its own bench and shelf.",
                "The living room is almost entirely curves: a cream modular sofa, round ottomans, a soft-edged TV ledge and a curved partition wall that leads to the dining area. Textured plaster finishes keep the surfaces from feeling flat.",
                "The dining space is deliberately darker, with a black table and chairs under rattan pendants, and the bedrooms return to white with fluted headboards and a single warm wall light."],
         gallery=["01","02","03","04","05","06","07","08","09","10","11","12"]),
    dict(slug="sonata", name="Sonata", place="48 Strathmore Avenue", year="2026", type="Residential · HDB",
         area="TBC", rooms="TBC", folder="strathmore", cover="assets/img/strathmore/01.jpg", portrait="assets/img/strathmore/07.jpg",
         tagline="Herringbone floors, a live-edge dining table and room for the piano. A resale flat rebuilt around music and light.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","M2D Interior")],
         paras=["The original flat had a dark feature wall and a narrow living room. We opened the plan, laid pale herringbone vinyl throughout and ran a wall of flush white cabinetry down one side to hide storage and the household shelter.",
                "A live-edge timber table on a single pedestal sits between the entrance and the sofa, with a built-in bench on the window side. The piano has its own alcove under a framed print.",
                "An olive tree marks the entrance, and the kitchen and bathroom pick up the same pale timber and white stone."],
         gallery=["01","02","03","04","05","06","07","08","09","10","11","12"]),
    dict(slug="rattan", name="Rattan", place="128 Bedok North Street 2", year="2025", type="Residential · 3-Room HDB",
         area="TBC", rooms="3-Room · 1 Bath", folder="bedok", cover="assets/img/bedok/01.jpg", portrait="assets/img/bedok/04.jpg",
         tagline="Rattan pendants over a marble island, checkerboard tiles at the door, and a round brass mirror. Small flat, big character.",
         credits=[("Design team","Benjamin Toh Jun Jie"),("Construction & build","M2D Carpentry"),("3D illustrations","M2D Interior & Consultancy"),("Photographer","M2D Interior")],
         paras=["In a three-room flat the kitchen does the most work, so we gave it the most character: a marble-look island with bar seating, two oversized rattan pendants and sage-grey shaker cabinets along the window wall.",
                "The entrance gets a classic black-and-white checkerboard floor with a built-in bench and shoe cabinets, meeting the timber parquet of the living room at a clean line.",
                "The bathroom vanity is a fluted white curve under a round brass mirror; the bedroom keeps to white, with a fluted headboard panel and a single ring wall light."],
         gallery=["01","02","03","04","05","06","07","08","09","10"]),
]

VIDEOS = [
    dict(id="X1bQeRM8WRQ", title="4-Room HDB BTO Tour", text="A complete walkthrough showcasing practical planning, cohesive styling and thoughtful details for modern BTO living."),
    dict(id="oPb18nsj8rk", title="Resale HDB Home Tour", text="See how an ageing resale flat was transformed into a functional, contemporary home tailored to the owners' lifestyle."),
    dict(id="zlmDV8aX4HM", title="Client Review: 4-Room BTO Renovation", text="A homeowner's honest experience working with our team from design consultation through to completion."),
]

REVIEWS = [
    ("Michelle & Stephen","Homeowners","Benjamin is a true problem solver. When unexpected issues arose during the renovation, he worked tirelessly to find a solution that worked for everyone. He made everything so easy and worry-free that we only went on site a few times. The end result is a beautiful, functional space that we adore."),
    ("Kate","Homeowner","He was always helpful and accommodating even when I frequently troubled him with trivial requests. When problems with the house or ex-owners arose, he never shied away but helped me overcome them together. My renovation journey was a stress-free one."),
    ("Nor Amirah & Fazlan","Homeowners","Throughout the entire process, pre-reno to post-reno, Ben always kept us updated and attended to our enquiries immediately. It's as if he works 24/7. He patiently helped us understand the pros and cons of various designs and guided us on the next steps."),
    ("Ee Pei & Jason","Homeowners","Benjamin's approach differed from others; he wasn't merely trying to fit our budget to 'close the deal' but was genuinely invested in elevating our living experience. His designs weren't just about aesthetics; they enhanced the flow of our daily routines."),
]

PROCESS = [
    ("01","Initial consultation",["Schedule a consultation through any of our channels","Articulate your vision, lifestyle and the atmosphere you want","Share specific requirements: budget, timeline, must-haves"]),
    ("02","Concept development",["We present initial design concepts and a detailed estimated budget","Collaborate closely with us: feedback and insights refine the design","Align design and budget with your expectations"]),
    ("03","Detailed planning",["3D visualisation and 3D video walkthrough","Detailed working plan for Stage 1 (foundation)","Detailed fitting drawings for Stage 2 (fitting)"]),
    ("04","Execution",["Foundation: M&E, ceiling, masonry / tiling, plastering, painting","Fitting: carpentry, painting, installations","Finishing: handover with touch-ups and finishes"]),
]

FAQ_HOME = [
    ("Do you offer virtual interior design consultations in Singapore?","Yes. We offer virtual design consultations for clients who prefer remote interactions or are located outside our service area. Our team will work closely with you to understand your vision and preferences, providing personalised design solutions tailored to your needs."),
    ("Do you handle renovation and construction projects?","Absolutely. We specialise in both interior design and renovation / construction. Whether you're refreshing your space with a new design or undertaking a full renovation, our experienced in-house team brings your vision to life."),
    ("How long does an interior design & renovation project take?","Design projects under 1,500 sqft take 3–4 weeks; over 1,500 sqft, 6–8 weeks. Renovation of new units (EC, new condo, BTO with OCS) takes about 5 weeks for 400–700 sqft and 6 weeks for 700–1,000 sqft. Older HDBs, condos and landed homes take 6 weeks (400–700 sqft), 8 weeks (700–1,000 sqft) or 12 weeks (1,000–1,400 sqft). These are estimates and vary with scope and material lead times."),
    ("Can you work within my home renovation budget?","Certainly. Your renovation need not cost an arm and a leg. We believe in practical, innovative and affordable interior design, with flexible solutions and transparent pricing so your project stays within budget without compromising on quality."),
    ("Are your interior design services licensed in Singapore?","With over 30 years of professional renovation experience, M2 Decor Pte Ltd is a BCA and HDB licensed contractor and an RCMA accredited renovation firm."),
]

FAQ_ABOUT = [
    ("Are you an interior design firm or a contractor?","We are an interior design firm with in-house capabilities: carpentry, ceiling and partition works, electrical works and simple masonry. We believe in a streamlined renovation where we both visualise and conceptualise your space, all in one. Covid-19 was a great reminder that with our own capabilities we can keep renovating cautiously without being too affected by restrictions and manpower."),
    ("How does M2D differ from other interior design companies?","We pride ourselves as doctors for interior spaces: you share your pain points, lifestyle, wants and needs, and we advise and operate on the apartment based on what you have shared. We are also a one-stop renovation company with both design and in-house build capabilities."),
    ("How many years of experience do you have?","Rooted in the artistry of crafting wood, our background in carpentry started back in 2001. Having seen how the industry transformed, we are determined to set the benchmark for what an interior designer should be, making it impossible for black sheep who focus on selling rather than solving."),
    ("What is a typical renovation duration?","For a full whole-house renovation above 800 sqft, the typical timeframe is roughly 12–14 weeks depending on the materials and design proposed. Specially indented materials may add shipping time."),
    ("What is your payment structure?","As a CaseTrust accredited firm, payment is broken into four phases: 10% at confirmation and design, 40% at foundation stage, 40% at fitting stage and 10% at handover and finishing. Any variation works within the agreed scope are added or deducted accordingly."),
    ("Can we see your workmanship in person?","We do not believe in a showroom. We are more than happy to arrange a site visit to a completed or in-progress home, subject to our client's agreement."),
]

# ---- Team (order = numbering on the About page). bio paragraphs separated by " | "
TEAM = [
    dict(name="Benjamin Toh", role="Director / Interior Designer", img="assets/img/about/ben.jpg",
         lede="You grew up around your father's carpentry workshop before leading M2D into interior design. What changed, and what stayed the same?",
         bio="The wood never left. Everything we draw today still has to be buildable by the people in our own workshop, and that discipline is what keeps our designs honest. | What changed is the conversation. Since 2015 we have treated every home like a consultation: you share the pain points, the lifestyle, the wants and the needs, and we advise and then operate. Design is only half of it; the other half is being on site until the handover is right.",),
    dict(name="Leon Yap", role="Architectural Designer", img="assets/img/about/leon.jpg",
         lede="Where does an architectural eye make the biggest difference inside a Singapore flat?",
         bio="In the plan. Most homes are not short of space; they are short of flow. Moving one wall, widening a threshold or borrowing light from the next room can change how a 90 square metre flat feels. | I look after the technical drawings and the 3D walkthroughs, so what a client approves on screen is exactly what the crew builds on site."),
    dict(name="Raymond Ng", role="Head Interior Designer", img="assets/img/about/11.jpg",
         lede="What makes a home feel 'undesigned', the way clients keep asking for?",
         bio="Restraint, and materials that age well. A home should look like it belongs to the people living in it, not to the designer. | I lead the design studio day to day: concept boards, material selection and the many small decisions between the first sketch and the final fitting."),
    dict(name="Tai Zhong", role="Carpenter", img="assets/img/about/06.jpg",
         lede="Two decades at the bench. What does a good piece of carpentry look like on site?",
         bio="Flush, square and quiet. Doors that close with one finger, drawers that still run true after ten years. | Our carpentry is fabricated in-house, which means the people who build the cabinets are the same people who install them."),
    dict(name="Suhel", role="Supervisor / General Worker", img="assets/img/about/10.jpg",
         lede="You are the one on site every day. What does a client never see but should know about?",
         bio="The sequence. Foundation works first, then fitting, then finishing, and nothing out of order. A clean, well-planned site is the difference between a 12-week renovation and a 16-week one. | I coordinate the crew, the deliveries and the daily photo updates that go back to the designers."),
    dict(name="Thi Ha", role="Carpenter", img="assets/img/about/09.jpg",
         lede="Which detail do you spend the most time getting right?",
         bio="Edges and joints. Laminate edges, mitred corners, the shadow gap between a cabinet and the ceiling. They are small, but they are where the eye goes first. | I work on built-in wardrobes, kitchen cabinets and feature walls."),
    dict(name="Chi Kuang", role="General Worker", img="assets/img/about/02.jpg",
         lede="What happens between hacking and handover?",
         bio="Everything dusty. Hacking, hauling, protection and the clean-ups between each trade. | I make sure the site is ready for the next stage before the next stage arrives."),
    dict(name="Hossain Rasal", role="General Worker", img="assets/img/about/07.jpg",
         lede="What do you take pride in?",
         bio="A level floor and a straight wall. Tiling and plastering are the base everything else sits on; if the base is off, every cabinet above it fights you. | I work across the foundation stage: masonry, tiling and plastering."),
    dict(name="Aung Ko Lin", role="Apprentice Carpenter", img="assets/img/about/08.jpg",
         lede="What are you learning this year?",
         bio="Measuring twice. Reading the fitting drawings, cutting to tolerance and finishing the surfaces that the client will touch every day. | Apprentices at M2D train under our senior carpenters in the workshop before they work on live sites."),
    dict(name="Mya Sein Tun", role="Apprentice Carpenter", img="assets/img/about/05.jpg",
         lede="Why carpentry?",
         bio="Because you can see what you made at the end of the day. | I assist on fabrication in the workshop and on-site installation under the senior team."),
]

STORY = [
    dict(year="2001", n="01", title="Where it all started", img="assets/img/home/05.jpg",
         text="M2D's story begins at a carpentry bench. Benjamin's father built the business on woodwork: cabinets, built-ins and the quiet discipline of making things that last. Rooted in the artistry of crafting wood, that background still shapes how we take on every project today."),
    dict(year="Father & son", n="02", title="The birth of craftsmanship", img="assets/img/home/01.jpg", wide=True,
         text="Two generations in one workshop. The first ran the fabrication and the crews; the second grew up on site, learned the trade from the ground up and brought design into the conversation. The company name honours that lineage: M Square Decor, the renovation and carpentry arm, and M2D Interior, the design studio."),
    dict(year="2015", n="03", title="Changing homes, changing lives", img="assets/img/about/01.jpg",
         text="Since 2015 we have focused on Singapore residential design and renovation, treating each home like a consultation rather than a sale. Over 200 households later, we are a trusted design-and-build firm with in-house carpentry, M&E and masonry, and a CaseTrust, HDB and BCA accredited team."),
    dict(year="Today", n="04", title="One team, four divisions", img="assets/img/home/07.jpg",
         text="M2D has grown into four divisions under one roof: Interior Design & Consultancy, Renovation & Carpentry, the Interior Design Workshop and Handyman & Home Repair. Different colours, one standard of work."),
]

DIVISIONS = [("Interior Design & Consultancy","#E37F32"),("Renovation & Carpentry","#6B4A14"),("Interior Design Workshop","#B3422D"),("Handyman & Home Repair","#1F4A3C")]

WORK_PHOTOS = [("assets/img/home/09.jpg","On site · Carpentry installation"),("assets/img/home/05.jpg","Workshop · Fabrication"),("assets/img/home/07.jpg","The crew")]

# Instagram strip: square crops from our own projects. Replace with real post images when you connect a feed.
IG_ITEMS = ["assets/img/serenity/01.jpg","assets/img/chaseki/02.jpg","assets/img/hotel/01.jpg","assets/img/hozon/02.jpg","assets/img/urban/06.jpg","assets/img/japandi/01.jpg","assets/img/serenity/04.jpg","assets/img/home/04.jpg","assets/img/chaseki/07.jpg","assets/img/urban/02.jpg"]

# Home "Our Services" columns: one per division. img = resting photo, hover = photo shown under the colour overlay.
SERVICE_COLS = [
    dict(key="design", colour="#E37F32", line1="Interior Design", line2="& Consultancy", img="assets/img/hozon/01.jpg", hover="assets/img/japandi/07.jpg", sub="Interior Design<br>and Consultancy",
         text="Space planning, concept boards, 3D visualisation and material selection, designed around how you actually live: the morning routine, the hosting, the quiet evenings."),
    dict(key="reno", colour="#6B4A14", line1="Renovation", line2="& Carpentry", img="assets/img/home/05.jpg", hover="assets/img/home/09.jpg", sub="Renovation<br>and Carpentry",
         text="Turnkey renovation with our own crew: M&E, ceiling, masonry, tiling, painting and carpentry fabricated in our workshop and installed by the people who built it."),
    dict(key="handyman", colour="#1F4A3C", line1="Handyman", line2="& Home Repair", img="assets/img/urban/06.jpg", hover="assets/img/hozon/05.jpg", sub="Handyman<br>and Home Repair",
         text="After the handover, we stay. Touch-ups, repairs, re-fits and small works for homes we built and homes we did not."),
    dict(key="workshop", colour="#B3422D", line1="Interior Design", line2="Workshop", img="assets/img/serenity/02.jpg", hover="assets/img/chaseki/06.jpg", sub="Interior Design<br>Workshop",
         text="Bespoke built-ins, feature walls and furniture made to drawing. Where a design needs a piece that does not exist yet, the workshop makes it."),
]

# ---- Project page layouts ----
# "reveal"     : title card (the place) opens, photos spread out from behind it, then scroll for the story + photo write-ups
# "horizontal" : side-scrolling story panels with photos and numbered paragraphs
# "editorial"  : vertical magazine grid with text blocks between photos
PROJECT_LAYOUT = {   # every home uses the side-scroll story ("horizontal"); "reveal" and "editorial" stay available in the CMS
    "hotel-at-home": "horizontal", "japandi-spirit": "horizontal", "embrace-serenity": "horizontal",
    "hozon": "horizontal", "urban-fusion": "horizontal", "chaseki": "horizontal",
    "oak-and-ember": "horizontal", "fu": "horizontal", "nimbus": "horizontal", "sonata": "horizontal", "rattan": "horizontal",
}
# background tone for the reveal card page (one per project; falls back to warm sand)
PROJECT_TONE = {}  # all project pages stay white
# optional short captions per photo number, e.g. {"hozon": {"01": "Dining · built-in bench"}}
PROJECT_CAPTIONS = {}


# ============================================================================================
# Page words and page photos. Everything below can also be changed in the CMS (/admin/).
# Line breaks ("\n") become line breaks on the page. Plain text only: "&" is fine as it is.
# ============================================================================================
SITE.setdefault("hours", "Mon – Sat, 10am – 7pm\nSite visits by appointment")
SITE.setdefault("ig_handle", "m2dinterior")

COPY = {
    # every page
    "seo.default_desc": "M2D Interior Design & Consultancy. Interior design and turnkey renovation for HDB, BTO, condo and landed homes in Singapore, with in-house carpentry since 2001.",
    "seo.title.home": "M2D · Interior Design & Consultancy Singapore",
    "seo.title.about": "About us · M2D Interior Design & Consultancy",
    "seo.title.portfolio": "Portfolio · M2D Interior Design & Consultancy",
    "seo.title.blog": "Blog · M2D Interior Design & Consultancy",
    "seo.title.contact": "Contact us · M2D Interior Design & Consultancy",
    "seo.desc.home": "", "seo.desc.about": "", "seo.desc.portfolio": "", "seo.desc.blog": "", "seo.desc.contact": "",
    "seo.title.services": "Services · M2D Interior Design, Renovation & Carpentry Singapore",
    "seo.desc.services": "Interior design and consultancy, renovation with in-house carpentry, a bespoke workshop and handyman repairs. Four M2D divisions under one roof in Singapore.",
    "services.eyebrow": "Services", "services.title": "Four divisions,\none roof",
    "services.lede": "Design, renovation and carpentry by our own crew, a workshop that builds what the design needs, and a handyman team that stays after the handover.",
    "nav.enquire": "Enquire",
    "footer.text": "Interior design and turnkey renovation for Singapore homes, with our own carpentry workshop since 2001. CaseTrust accredited · HDB & BCA licensed.",
    "footer.h_info": "Information", "footer.h_projects": "Projects", "footer.h_enquire": "Enquire",
    "footer.copyright": "© 2026 M2 Decor Pte Ltd · All rights reserved",
    "footer.right": "M2D Interior Design & Consultancy",
    "cta.title": "Next step to\nyour dream home.",
    "cta.text": "Book a consultation. Share your pain points, lifestyle and wishlist, and we will advise, plan and build.",
    "cta.button": "Book a consultation",
    # home
    "home.preloader_tag": "Interior Design & Consultancy",
    "home.hero_title": "Interior\nDesign\nStudio",
    "home.hero_text": "We specialise in interior design, turnkey renovation and in-house carpentry for Singapore homes: HDB, BTO, condominium and landed. Design-centric, streamlined, from the ground up.",
    "home.hero_button": "Portfolio",
    "home.featured_title": "As featured in",
    "home.ig_eyebrow": "Instagram", "home.ig_follow": "Follow us",
    "home.svc_tag": "Doing our job\nfrom the bottom\nof our hearts", "home.svc_word1": "Our", "home.svc_word2": "Services", "home.svc_more": "Learn more",
    "home.why_eyebrow": "Why M2D",
    "home.why_title": "Design centric.\nStreamlined design & build.\nFrom the ground up.",
    "home.why_text": "Our roots lie in the art of woodwork. That background gives us a deep appreciation for materials, structure and space, and a crew that builds what we draw.",
    "home.rh_eyebrow": "Selected works", "home.rh_title": "Real homes,\nreal stories.", "home.rh_button": "View portfolio", "home.rh_main_alt": "Nimbus, 443 Punggol",
    "home.yt_eyebrow": "YouTube", "home.yt_title": "Step inside\nour homes.", "home.yt_link": "Watch more on YouTube",
    "home.rev_eyebrow": "Loved by homeowners", "home.rev_score": "5",
    "home.rev_text": "Over 95% positive reviews across Google, HomeTrust and Facebook. Read what the people living in our homes have to say.",
    "home.rev_sources": "Google\nHomeTrust\nFacebook", "home.rev_link": "Read all on Google",
    "home.proc_eyebrow": "The process", "home.proc_title": "From conception\nto execution.", "home.proc_link": "About our studio",
    "home.blog_eyebrow": "Journal", "home.blog_title": "Latest articles.", "home.blog_button": "See all articles",
    "home.faq_eyebrow": "FAQ", "home.faq_title": "Frequently asked\nquestions.",
    "home.faq_text": "Not answered here? Drop us a message on WhatsApp and we will reply within the day.",
    # about
    "about.hero_alt": "Fú, 27 West Coast",
    "about.corner_tl": "About\nus", "about.corner_br": "Changing lives,\nchanging homes.", "about.label": "About us",
    "about.ph_eyebrow": "About us", "about.ph_title": "Our design philosophy",
    "about.ph_p1": "M2 Decor Pte Ltd was established as a one-stop, streamlined interior design and renovation company in Singapore. Since 2015 we have ventured into residential design and renovation, value-adding homeowners with our intricate craft. Today we are a trusted firm with over 200 satisfied residential clients.",
    "about.ph_p2": "We pride ourselves as doctors for interior spaces: you share your pain points, lifestyle, wants and needs, and we advise and operate the home based on what you have shared. What sets us apart is our fusion of creativity and functionality, with a foundation deeply rooted in craftsmanship.",
    "about.ph_cap": "Spaces we\ncall ours",
    "about.team_alt": "The M2D team", "about.th_eyebrow": "The M2D family", "about.th_title": "One team,\ntwo generations.",
    "about.mission_title": "Our mission",
    "about.mission_text": "To be the preferred choice for homeowners looking to hire an interior designer who demonstrates integrity and professionalism, delivering results beyond expectation and setting the benchmark for service in the renovation industry.",
    "about.vision_title": "Our vision",
    "about.vision_text": "We exist to create interior design that works and wows, turning every house entrusted to us into a beautiful and functional masterpiece within which our clients experience emotion and life.",
    "about.team_eyebrow": "Our team", "about.team_title": "The people\nbehind the work.",
    "about.team_lede": "Creative team and core crew. Click a portrait to read their page.",
    "about.team_vert": "M2D Interior · Creative team & core crew · 2026",
    "about.story_tag": "The birth of\ncraftsmanship\nsince 2001", "about.story_word1": "Where it", "about.story_word2": "All started",
    "about.work_eyebrow": "How we work", "about.work_title": "Workshop,\nsite, handover.",
    "about.work_lede": "We do not believe in a showroom. Our carpentry is fabricated in our own workshop and installed by our own crew.",
    "about.proc_eyebrow": "The process", "about.proc_title": "Four stages,\none team.",
    "about.faq_eyebrow": "FAQ", "about.faq_title": "Questions\nwe get asked.",
    # portfolio
    "portfolio.title": "Our Portfolio", "portfolio.scroll": "Scroll to explore", "portfolio.homes": "homes", "portfolio.hint": "Click & drag",
    # blog
    "blog.eyebrow": "Journal", "blog.title": "Blog",
    "blog.lede": "Stay updated with the latest trends. Whether you are a design enthusiast or a homeowner looking for fresh ideas, you will find practical content to bring your vision to life.",
    # contact
    "contact.eyebrow": "Contact us", "contact.title": "Drop us\na message",
    "contact.lede": "Tell us about your home. We reply within the day, and we are happy to arrange a site visit to one of our completed homes.",
    "contact.h_wa": "WhatsApp / Call", "contact.h_email": "Email", "contact.h_studio": "Studio & workshop", "contact.h_hours": "Hours", "contact.h_follow": "Follow",
}

PHOTOS = {
    "home.hero_video": "assets/video/hero.mp4",
    "home.hero_poster": "assets/video/hero-poster.jpg",
    "home.hero_end": "assets/video/hero-end.jpg",   # the video's last frame, shown at once when a visitor comes back to Home
    "home.rh_main": "assets/img/punggol/01.jpg",
    "home.rh_sat1": "assets/img/thumb/serenity-01.jpg", "home.rh_sat2": "assets/img/thumb/hotel-04.jpg", "home.rh_sat3": "assets/img/thumb/japandi-01.jpg",
    "home.rh_sat4": "assets/img/thumb/chaseki-06.jpg", "home.rh_sat5": "assets/img/thumb/urban-06.jpg", "home.rh_sat6": "assets/img/thumb/hozon-05.jpg",
    "about.hero": "assets/img/westcoast/01.jpg",
    # four small photos around the opener video on desktop; they move away as the video expands
    "about.op1": "assets/img/about/ben-leon.jpg", "about.op2": "assets/img/home/05.jpg",
    "about.op3": "assets/img/westcoast/01.jpg", "about.op4": "assets/img/home/09.jpg",
    "about.hero_video": "assets/video/hero-scrub.mp4",   # runs with the scroll as the opener expands (every frame a keyframe, so it scrubs smoothly); empty = use the photo above
    "about.team": "assets/img/home/01.jpg",
    "contact.hero": "assets/img/punggol/01.jpg",
    "services.hero": "assets/img/hozon/04.jpg",
    "cta.home": "assets/img/japandi/02.jpg",
    "cta.about": "assets/img/urban/04.jpg",
    "cta.blog": "assets/img/chaseki/09.jpg",
    "cta.project": "assets/img/hozon/04.jpg",
}

# the first three people are the creative team, the rest the core crew (the About page title switches between them)
for _i, _t in enumerate(TEAM):
    _t.setdefault("group", "creative" if _i < 3 else "core")

SITE.setdefault("url", "https://www.m2decor.com")   # the live address, used for the sitemap
