import { useEffect, useMemo, useRef, useState } from 'react'
import './DepartmentSearch.css'

const DEPARTMENTS = [
  { code: 'AHS', name: 'Academic Health Center Shared' },
  { code: 'ACCT', name: 'Accounting' },
  { code: 'ADDS', name: 'Addiction Studies' },
  { code: 'ADPY', name: 'Adult Psychiatry' },
  { code: 'AEM', name: 'Aerospace Engineering and Mechanics' },
  { code: 'AIR', name: 'Aerospace Studies' },
  { code: 'AFRO', name: 'African American and African Studies' },
  { code: 'AECM', name: 'Agricultural Education, Communication & Marketing' },
  { code: 'AGRO', name: 'Agronomy and Plant Genetics' },
  { code: 'AMIN', name: 'American Indian Studies' },
  { code: 'ASL', name: 'American Sign Language' },
  { code: 'AMST', name: 'American Studies' },
  { code: 'ANAT', name: 'Anatomy' },
  { code: 'ANES', name: 'Anesthesiology' },
  { code: 'ANSC', name: 'Animal Science' },
  { code: 'ANTH', name: 'Anthropology' },
  { code: 'ADES', name: 'Apparel Design' },
  { code: 'APST', name: 'Apparel Studies' },
  { code: 'ABUS', name: 'Applied Business' },
  { code: 'APEC', name: 'Applied Economics' },
  { code: 'APSC', name: 'Applied Plant Sciences' },
  { code: 'APS', name: 'Applied Professional Studies' },
  { code: 'ASCL', name: 'Applied Sciences Leadership' },
  { code: 'ARAB', name: 'Arabic' },
  { code: 'MRCO', name: 'Arabic Language and Culture in Morocco' },
  { code: 'ARCH', name: 'Architecture' },
  { code: 'ARTS', name: 'Art' },
  { code: 'ARTH', name: 'Art History' },
  { code: 'ACL', name: 'Arts and Cultural Leadership' },
  { code: 'AAS', name: 'Asian American Studies' },
  { code: 'AMES', name: 'Asian and Middle Eastern Studies' },
  { code: 'AST', name: 'Astronomy' },
  { code: 'ARGN', name: 'Study Abroad in Argentina' },
  { code: 'BIOC', name: 'Biochemistry' },
  { code: 'BTHX', name: 'Bioethics, Center for' },
  { code: 'BIOL', name: 'Biology' },
  { code: 'BSE', name: 'Biology, Society, and Environment' },
  { code: 'BMEN', name: 'Biomedical Engineering' },
  { code: 'BBE', name: 'Bioproducts and Biosystems Engineering' },
  { code: 'BA', name: 'Business Administration' },
  { code: 'BLAW', name: 'Business Law' },
  { code: 'CMBA', name: 'Carlson Executive MBA' },
  { code: 'CSOM', name: 'Carlson School of Management' },
  { code: 'COP', name: 'Cellular and Organismal Physiology' },
  { code: 'CAHP', name: 'Center for Allied Health Programs' },
  { code: 'CSPH', name: 'Center for Spirituality and Healing' },
  { code: 'CHEN', name: 'Chemical Engineering' },
  { code: 'CHPH', name: 'Chemical Physics' },
  { code: 'CHEM', name: 'Chemistry' },
  { code: 'CHLS', name: 'Chicano and Latino Studies' },
  { code: 'CPSY', name: 'Child Psychology' },
  { code: 'CAPY', name: 'Child and Adolescent Psychiatry' },
  { code: 'CHN', name: 'Chinese' },
  { code: 'CIVE', name: 'Civic Engagement' },
  { code: 'CEGE', name: 'Civil, Environmental, and Geo-Engineering' },
  { code: 'CNRC', name: 'Classical and Near Eastern Religions and Cultures' },
  { code: 'CPMS', name: 'Clinical Physiology and Movement Science' },
  { code: 'CGSC', name: 'Cognitive Science' },
  { code: 'MNMD', name: 'Collaborative Medicine' },
  { code: 'CFAN', name: 'College of Food, Agri & Natural Resource Sciences' },
  { code: 'CLA', name: 'College of Liberal Arts' },
  { code: 'CSE', name: 'College of Science and Engineering' },
  { code: 'COMM', name: 'Communication Studies' },
  { code: 'CESP', name: 'Community Engagement Scholars Program' },
  { code: 'CMB', name: 'Comparative and Molecular Biosciences' },
  { code: 'CMPE', name: 'Computer Engineering' },
  { code: 'CSCI', name: 'Computer Science' },
  { code: 'CONS', name: 'Conservation Sciences' },
  { code: 'CMGT', name: 'Construction Management' },
  { code: 'CSCL', name: 'Cultural Studies and Comparative Literature' },
  { code: 'CI', name: 'Curriculum and Instruction' },
  { code: 'CVM', name: 'Veterinary Medicine' },
  { code: 'DAKO', name: 'Dakota' },
  { code: 'DNCE', name: 'Dance' },
  { code: 'DSCI', name: 'Data Science' },
  { code: 'DH', name: 'Dental Hygiene' },
  { code: 'DT', name: 'Dental Therapy' },
  { code: 'DENT', name: 'Dentistry' },
  { code: 'DESI', name: 'Department of Design Innovation' },
  { code: 'DERM', name: 'Dermatology' },
  { code: 'DES', name: 'Design' },
  { code: 'DSSC', name: 'Development Studies and Social Change' },
  { code: 'DDS', name: 'Doctor of Dental Surgery' },
  { code: 'DTCH', name: 'Dutch' },
  { code: 'DBLN', name: 'Study Abroad in Dublin' },
  { code: 'ESCI', name: 'Earth Sciences' },
  { code: 'EAS', name: 'East Asian Studies' },
  { code: 'EEB', name: 'Ecology, Evolution, and Behavior' },
  { code: 'ECON', name: 'Economics' },
  { code: 'EDUC', name: 'Education' },
  { code: 'EDHD', name: 'Education and Human Development' },
  { code: 'EPSY', name: 'Educational Psychology' },
  { code: 'EE', name: 'Electrical and Computer Engineering' },
  { code: 'EMMD', name: 'Emergency Medicine' },
  { code: 'ENDO', name: 'Endodontics' },
  { code: 'ESL', name: 'English as a Second Language' },
  { code: 'ENGL', name: 'English: Literature' },
  { code: 'ENGW', name: 'English: Creative Writing' },
  { code: 'ENT', name: 'Entomology' },
  { code: 'ENTR', name: 'Entrepreneurship' },
  { code: 'ESPM', name: 'Environmental Sciences, Policy, and Management' },
  { code: 'ECP', name: 'Experimental and Clinical Pharmacology' },
  { code: 'FMCH', name: 'Family Medicine and Community Health' },
  { code: 'FSOS', name: 'Family Social Science' },
  { code: 'FINA', name: 'Finance' },
  { code: 'FM', name: 'Financial Mathematics' },
  { code: 'FIN', name: 'Finnish' },
  { code: 'FW', name: 'Fisheries and Wildlife' },
  { code: 'FSCN', name: 'Food Science and Nutrition' },
  { code: 'FDSY', name: 'Food Systems' },
  { code: 'FNRM', name: 'Forest and Natural Resource Management' },
  { code: 'FREN', name: 'French' },
  { code: 'FRIT', name: 'French and Italian' },
  { code: 'FLOR', name: 'Study Abroad in Florence' },
  { code: 'GLBT', name: 'Gay, Lesbian, Bisexual, and Transgender Studies' },
  { code: 'GWSS', name: 'Gender, Women, and Sexuality Studies' },
  { code: 'GCD', name: 'Genetics, Cell Biology and Development' },
  { code: 'GIS', name: 'Geographic Information Science' },
  { code: 'GEOG', name: 'Geography' },
  { code: 'GERI', name: 'Geriatrics' },
  { code: 'GER', name: 'German' },
  { code: 'GSD', name: 'German, Scandinavian, and Dutch' },
  { code: 'GERO', name: 'Gerontology' },
  { code: 'GDBA', name: 'Global Doctorate of Business' },
  { code: 'GHSR', name: 'Global Health and Social Responsibility' },
  { code: 'GLOS', name: 'Global Studies' },
  { code: 'GCC', name: 'Grand Challenge Curriculum' },
  { code: 'GDES', name: 'Graphic Design' },
  { code: 'GRK', name: 'Greek' },
  { code: 'HSM', name: 'Health Services Management' },
  { code: 'HEBR', name: 'Hebrew' },
  { code: 'HSPH', name: 'Heritage Studies and Public History' },
  { code: 'HNDI', name: 'Hindi' },
  { code: 'HNUR', name: 'Hindi-Urdu' },
  { code: 'HIST', name: 'History' },
  { code: 'HMED', name: 'History of Medicine' },
  { code: 'HSCI', name: 'History of Science and Technology' },
  { code: 'HMNG', name: 'Hmong' },
  { code: 'HCOL', name: 'Honors Colloquia' },
  { code: 'HSEM', name: 'Honors Seminar' },
  { code: 'HORT', name: 'Horticultural Science' },
  { code: 'HSG', name: 'Housing Studies' },
  { code: 'HUMF', name: 'Human Factors' },
  { code: 'HRIR', name: 'Human Resources and Industrial Relations' },
  { code: 'HSEX', name: 'Human Sexuality' },
  { code: 'IE', name: 'Industrial Engineering' },
  { code: 'INET', name: 'Information Networking' },
  { code: 'IDSC', name: 'Information and Decision Sciences' },
  { code: 'INS', name: 'Insurance and Risk Management' },
  { code: 'IBH', name: 'Integrated Behavioral Health' },
  { code: 'IFSL', name: 'Integrated Food Systems Leadership' },
  { code: 'ICP', name: 'Inter-College Program' },
  { code: 'INAR', name: 'Interdisciplinary Archaeological Studies' },
  { code: 'IDES', name: 'Interior Design' },
  { code: 'IBUS', name: 'International Business' },
  { code: 'ITAL', name: 'Italian' },
  { code: 'JPN', name: 'Japanese' },
  { code: 'JWST', name: 'Jewish Studies' },
  { code: 'JOUR', name: 'Journalism and Mass Communication' },
  { code: 'KIN', name: 'Kinesiology' },
  { code: 'KOR', name: 'Korean' },
  { code: 'LAAS', name: 'Land and Atmospheric Science' },
  { code: 'LA', name: 'Landscape Architecture' },
  { code: 'LANG', name: 'Language Center CLA Courseshare' },
  { code: 'LGTT', name: 'Language, Teaching, and Technology' },
  { code: 'LAT', name: 'Latin' },
  { code: 'LAS', name: 'Latin American Studies' },
  { code: 'LAW', name: 'Law School' },
  { code: 'LEAD', name: 'Leadership Education' },
  { code: 'LING', name: 'Linguistics' },
  { code: 'LM', name: 'Logistics Management' },
  { code: 'LNDN', name: 'Study Abroad in London' },
  { code: 'MADR', name: 'Madrid Learning Abroad Program' },
  { code: 'MGMT', name: 'Management' },
  { code: 'MOT', name: 'Management of Technology' },
  { code: 'MCOM', name: 'Managerial Communications' },
  { code: 'MKTG', name: 'Marketing' },
  { code: 'MATS', name: 'Materials Science' },
  { code: 'MATH', name: 'Mathematics' },
  { code: 'MTHE', name: 'Mathematics Education' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'MDI', name: 'Medical Device Innovation' },
  { code: 'MPHY', name: 'Medical Physics' },
  { code: 'MEDC', name: 'Medicinal Chemistry' },
  { code: 'MED', name: 'Medicine' },
  { code: 'MEST', name: 'Medieval Studies' },
  { code: 'MICE', name: 'Microbial Engineering' },
  { code: 'MICB', name: 'Microbiology' },
  { code: 'MICA', name: 'Microbiology, Immunology, and Cancer Biology' },
  { code: 'MIL', name: 'Military Science' },
  { code: 'MSID', name: 'Minnesota Studies in International Development' },
  { code: 'MCDG', name: 'Molecular Cellular Developmental Biology and Genetics' },
  { code: 'MORT', name: 'Mortuary Science' },
  { code: 'MIMS', name: 'Moving Image Studies' },
  { code: 'MDS', name: 'Multidisciplinary Studies' },
  { code: 'MST', name: 'Museum Studies' },
  { code: 'MUS', name: 'Music' },
  { code: 'MUSA', name: 'Music Applied' },
  { code: 'MUED', name: 'Music Education' },
  { code: 'MONT', name: 'Study Abroad in Montpellier' },
  { code: 'NAV', name: 'Naval Science' },
  { code: 'NEUR', name: 'Neurology' },
  { code: 'NSC', name: 'Neuroscience' },
  { code: 'NOR', name: 'Norwegian' },
  { code: 'NURS', name: 'Nursing' },
  { code: 'NUTR', name: 'Nutrition' },
  { code: 'OT', name: 'Occupational Therapy' },
  { code: 'OJIB', name: 'Ojibwe' },
  { code: 'OPH', name: 'Ophthalmology' },
  { code: 'OLPD', name: 'Organizational Leadership, Policy and Development' },
  { code: 'PATH', name: 'Pathology' },
  { code: 'PED', name: 'Pediatrics' },
  { code: 'PHM', name: 'Pharmaceutics' },
  { code: 'PHCL', name: 'Pharmacology' },
  { code: 'PHAR', name: 'Pharmacy' },
  { code: 'PHIL', name: 'Philosophy' },
  { code: 'PE', name: 'Physical Education' },
  { code: 'PT', name: 'Physical Therapy' },
  { code: 'PHYS', name: 'Physics' },
  { code: 'PHSL', name: 'Physiology' },
  { code: 'PLPA', name: 'Plant Pathology' },
  { code: 'PLSC', name: 'Plant Science' },
  { code: 'PMB', name: 'Plant and Microbial Biology' },
  { code: 'POL', name: 'Political Science' },
  { code: 'PORT', name: 'Portuguese' },
  { code: 'PDES', name: 'Product Design' },
  { code: 'PSY', name: 'Psychology' },
  { code: 'PA', name: 'Public Affairs' },
  { code: 'PUBH', name: 'Public Health' },
  { code: 'RSC', name: 'Rehabilitation Science' },
  { code: 'RELS', name: 'Religious Studies' },
  { code: 'RM', name: 'Retail & Consumer Studies' },
  { code: 'ROB', name: 'Robotics' },
  { code: 'RUSS', name: 'Russian' },
  { code: 'SCAN', name: 'Scandinavian' },
  { code: 'SCIC', name: 'Scientific Computation' },
  { code: 'ST', name: 'Security Technologies' },
  { code: 'SW', name: 'Social Work' },
  { code: 'SOC', name: 'Sociology' },
  { code: 'SENG', name: 'Software Engineering' },
  { code: 'SOIL', name: 'Soil, Water, and Climate' },
  { code: 'SMLI', name: 'Somali' },
  { code: 'SPAN', name: 'Spanish' },
  { code: 'SPPT', name: 'Spanish and Portuguese' },
  { code: 'SLHS', name: 'Speech-Language-Hearing Sciences' },
  { code: 'SMGT', name: 'Sport Management' },
  { code: 'STAT', name: 'Statistics' },
  { code: 'SUST', name: 'Sustainability Studies' },
  { code: 'SSM', name: 'Sustainable Systems Management' },
  { code: 'SWAH', name: 'Swahili' },
  { code: 'SWED', name: 'Swedish' },
  { code: 'TH', name: 'Theatre Arts' },
  { code: 'TXCL', name: 'Toxicology' },
  { code: 'URBS', name: 'Urban Studies' },
  { code: 'URDU', name: 'Urdu' },
  { code: 'UX', name: 'User Experience Design' },
  { code: 'VCS', name: 'Veterinary Clinical Sciences' },
  { code: 'VMED', name: 'Veterinary Medicine, Graduate' },
  { code: 'VPM', name: 'Veterinary Population Medicine' },
  { code: 'VIET', name: 'Vietnamese' },
  { code: 'VIRO', name: 'Virology' },
  { code: 'WRS', name: 'Water Resources Science' },
  { code: 'WRIT', name: 'Writing Studies' },
  { code: 'YOST', name: 'Youth Development and Research' },
]

function highlightCode(code, q) {
  if (!q) return code
  const lowerCode = code.toLowerCase()
  const lowerQ = q.toLowerCase()
  if (!lowerCode.startsWith(lowerQ)) return code
  return (
    <>
      <mark>{code.slice(0, q.length)}</mark>
      {code.slice(q.length)}
    </>
  )
}

function highlightName(name, q) {
  if (!q) return name
  const lowerName = name.toLowerCase()
  const lowerQ = q.toLowerCase()
  const idx = lowerName.indexOf(lowerQ)
  if (idx < 0) return name
  return (
    <>
      {name.slice(0, idx)}
      <mark>{name.slice(idx, idx + q.length)}</mark>
      {name.slice(idx + q.length)}
    </>
  )
}

export default function DepartmentSearch({
  value,
  onChange,
  placeholder = 'Search department...',
  required = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const listRef = useRef(null)

  const selected = useMemo(
    () => DEPARTMENTS.find((d) => d.code === value) || null,
    [value]
  )
  const selectedDisplay = selected ? `${selected.code} — ${selected.name}` : ''

  const matches = useMemo(() => {
    const q = query.trim()
    if (!q) return DEPARTMENTS
    const lq = q.toLowerCase()
    return DEPARTMENTS.filter(
      (d) =>
        d.code.toLowerCase().startsWith(lq) ||
        d.name.toLowerCase().includes(lq)
    )
  }, [query])

  useEffect(() => {
    setActiveIdx(0)
  }, [query, open])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open || !listRef.current) return
    const activeEl = listRef.current.querySelector(`[data-idx="${activeIdx}"]`)
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  function handleFocus() {
    setOpen(true)
    setQuery('')
  }

  function handleChange(e) {
    setQuery(e.target.value)
    if (!open) setOpen(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActiveIdx((i) => Math.min(matches.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (open && matches[activeIdx]) {
        e.preventDefault()
        selectOption(matches[activeIdx])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  function selectOption(d) {
    onChange(d.code)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  function clearSelection(e) {
    e.preventDefault()
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const displayedValue = open ? query : selectedDisplay
  const showClear = !!value && !open

  return (
    <div className="dept-search" ref={containerRef}>
      <div className="dept-search-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="dept-search-input"
          value={displayedValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="dept-search-list"
        />
        {showClear && (
          <button
            type="button"
            className="dept-search-clear"
            onMouseDown={clearSelection}
            aria-label="Clear selection"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          id="dept-search-list"
          className="dept-search-list"
          ref={listRef}
          role="listbox"
        >
          {matches.length === 0 ? (
            <li className="dept-search-empty">No departments found</li>
          ) : (
            matches.map((d, i) => (
              <li
                key={d.code}
                data-idx={i}
                className={
                  'dept-search-option' +
                  (i === activeIdx ? ' is-active' : '') +
                  (d.code === value ? ' is-selected' : '')
                }
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(d)
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="dept-search-code">
                  {highlightCode(d.code, query.trim())}
                </span>
                <span className="dept-search-sep"> — </span>
                <span className="dept-search-name">
                  {highlightName(d.name, query.trim())}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
