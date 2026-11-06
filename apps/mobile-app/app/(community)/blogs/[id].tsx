import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

export default function BlogReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [blog, setBlog] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState<number>(1.0); // 1.0, 1.2, 1.4
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);

  const fetchBlogDetails = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/community/blogs/${id}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setBlog(json.data.blog);
        setIsLiked(json.data.userLiked || false);
        setIsBookmarked(json.data.userBookmarked || false);
        setLikeCount(json.data.blog?.likeCount || 0);
      }
    } catch (e) {
      console.error('Fetch blog error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchBlogDetails();
  }, [id]);

  const toggleFontSize = () => {
    if (fontSizeMultiplier === 1.0) setFontSizeMultiplier(1.2);
    else if (fontSizeMultiplier === 1.2) setFontSizeMultiplier(1.4);
    else setFontSizeMultiplier(1.0);
  };

  const handleShare = async () => {
    if (!blog) return;
    try {
      await Share.share({
        message: `${blog.title}\n\nRead more insightful senior health articles on MaiHoonNa.`,
        title: blog.title,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleToggleLike = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;
    setIsLiked(prev => !prev);
    setLikeCount(prev => (isLiked ? prev - 1 : prev + 1));

    try {
      await fetch(`${API_URL}/community/interactions/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ itemType: 'blog', blogId: id }),
      });
    } catch (e) {
      console.error('Like toggle error:', e);
    }
  };

  const handleToggleBookmark = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;
    setIsBookmarked(prev => !prev);

    try {
      await fetch(`${API_URL}/community/interactions/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ itemType: 'blog', blogId: id }),
      });
    } catch (e) {
      console.error('Bookmark toggle error:', e);
    }
  };

  if (loading || !blog) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FE6700" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Top Bar with Actions ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          {/* Senior Font Size Toggle */}
          <TouchableOpacity onPress={toggleFontSize} style={styles.fontSizeBtn}>
            <Text style={styles.fontSizeBtnText}>A{fontSizeMultiplier > 1 ? '+' : ''}</Text>
          </TouchableOpacity>

          {/* Bookmark Toggle */}
          <TouchableOpacity onPress={handleToggleBookmark} style={styles.iconBtn}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isBookmarked ? '#FE6700' : '#0F172A'}
            />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Feather name="share-2" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {blog.resolvedThumbnailUrl && (
          <Image source={{ uri: blog.resolvedThumbnailUrl }} style={styles.coverImage} resizeMode="cover" />
        )}

        <View style={styles.articleBody}>
          {blog.category && (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{blog.category.name}</Text>
            </View>
          )}

          <Text style={[styles.title, { fontSize: 22 * fontSizeMultiplier }]}>{blog.title}</Text>

          {/* Author & Read Time Header */}
          <View style={styles.authorMetaRow}>
            {blog.author?.avatarUrl ? (
              <Image source={{ uri: blog.author.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{blog.author?.name ? blog.author.name[0] : 'M'}</Text>
              </View>
            )}
            <View style={styles.authorMeta}>
              <Text style={styles.authorName}>{blog.author?.name || 'MaiHoonNa Medical Board'}</Text>
              <Text style={styles.metaSubtext}>
                {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                • {blog.readingTimeMinutes || 3} min read
              </Text>
            </View>
          </View>

          {/* Short description quote */}
          <View style={styles.quoteBox}>
            <Text style={[styles.quoteText, { fontSize: 15 * fontSizeMultiplier }]}>
              {blog.shortDescription}
            </Text>
          </View>

          {/* Rich Content rendering */}
          <Text style={[styles.contentText, { fontSize: 16 * fontSizeMultiplier, lineHeight: 26 * fontSizeMultiplier }]}>
            {blog.richContent}
          </Text>

          {/* ── Footer Reactions ── */}
          <View style={styles.reactionFooter}>
            <TouchableOpacity onPress={handleToggleLike} style={styles.likeBtn}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={isLiked ? '#EF4444' : '#64748B'}
              />
              <Text style={[styles.likeCountText, isLiked && { color: '#EF4444' }]}>
                {likeCount} Helpful
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBtn: {
    padding: 8,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontSizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  fontSizeBtnText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#0F172A',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverImage: {
    width: '100%',
    height: 220,
  },
  articleBody: {
    padding: 20,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  categoryText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    color: '#2563EB',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#D97706',
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#0F172A',
  },
  metaSubtext: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#64748B',
  },
  quoteBox: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 4,
    borderLeftColor: '#FE6700',
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  quoteText: {
    fontFamily: 'Poppins-Medium',
    color: '#9A3412',
    fontStyle: 'italic',
  },
  contentText: {
    fontFamily: 'Poppins-Regular',
    color: '#1E293B',
  },
  reactionFooter: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  likeCountText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#475569',
  },
});

