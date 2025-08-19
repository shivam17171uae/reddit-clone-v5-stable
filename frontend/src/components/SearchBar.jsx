import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Debounce to prevent API calls on every keystroke
    const debounceTimeout = setTimeout(() => {
      fetch(`/api/search?q=${query}`)
        .then(res => res.json())
        .then(data => {
          setResults(data);
          setIsOpen(data.length > 0);
        });
    }, 300); // Wait for 300ms after user stops typing

    return () => clearTimeout(debounceTimeout);
  }, [query]);

  // Effect to handle clicks outside of the search component
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchRef]);

  const getLink = (result) => {
    switch (result.type) {
      case 'post':
        return `/c/${result.context}/posts/${result.id}`;
      case 'community':
        return `/c/${result.name}`;
      case 'user':
        return `/u/${result.name}`;
      default:
        return '/';
    }
  };

  const clearSearch = () => {
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-xs" ref={searchRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && results.length > 0 && setIsOpen(true)}
        placeholder="Search Shivam's Hub"
        className="w-full bg-gray-700 text-white p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-700 rounded-lg shadow-xl z-30 border border-gray-600">
          <ul>
            {results.length > 0 ? (
              results.map((result, index) => (
                <li key={`${result.type}-${result.id}-${index}`}>
                  <Link
                    to={getLink(result)}
                    onClick={clearSearch}
                    className="block px-4 py-3 hover:bg-gray-600 transition-colors duration-150"
                  >
                    <div className="font-bold text-white">{result.name}</div>
                    <div className="text-sm text-gray-400 capitalize">
                      {result.type} {result.context && `in c/${result.context}`}
                    </div>
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-gray-400">No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchBar;