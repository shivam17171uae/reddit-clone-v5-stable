import { useState, useEffect, useRef, useCallback } from 'react';

export const useInfiniteScroll = (fetchFunction) => {
    const [page, setPage] = useState(1);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const loaderRef = useRef(null);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        try {
            const newData = await fetchFunction(page);
            setData(prev => [...prev, ...newData]);
            setHasMore(newData.length > 0);
            setPage(prev => prev + 1);
        } catch (error) {
            console.error("Failed to fetch more data:", error);
        } finally {
            setLoading(false);
        }
    }, [page, loading, hasMore, fetchFunction]);
    
    useEffect(() => {
        // Reset state when the fetch function changes (e.g., sort type changes)
        setData([]);
        setPage(1);
        setHasMore(true);
    }, [fetchFunction]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0];
                if (target.isIntersecting) {
                    loadMore();
                }
            },
            { rootMargin: '100px' } // Load content before it's visible
        );

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }

        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
        };
    }, [loadMore]);
    
    return { data, loading, loaderRef, setData };
};
