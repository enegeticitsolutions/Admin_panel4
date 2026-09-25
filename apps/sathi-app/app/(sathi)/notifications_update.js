const fs = require('fs');
const file = "/Users/puneet/Desktop/MHN/apps/sathi-app/app/(sathi)/notifications.tsx";
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variables for selection mode
content = content.replace(
  "const [refreshing, setRefreshing] = useState(false);",
  "const [refreshing, setRefreshing] = useState(false);\n  const [isSelectionMode, setIsSelectionMode] = useState(false);\n  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());"
);

// 2. Add handleDeleteSelected function
const deleteSelectedCode = `
  const handleDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedIds);
    setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        await Promise.all(idsToDelete.map(id => {
          return fetch(\`\${API_URL}/notifications/\${id}\`, {
            method: 'DELETE',
            headers: { 'Authorization': \`Bearer \${token}\` },
          });
        }));
      }
    } catch (e) {
      console.log('Error deleting selected notifications:', e);
    }
  };
`;
content = content.replace(
  "const confirmClearAll = () => {",
  deleteSelectedCode + "\n  const confirmClearAll = () => {"
);

// 3. Update header actions for selection mode
const newHeaderActions = `
        <View style={styles.headerActions}>
          {isSelectionMode ? (
            <>
              <TouchableOpacity onPress={() => setIsSelectionMode(false)}>
                <Text style={[styles.markAllText, { color: '#6B7280', marginRight: 12 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (selectedIds.size === notifications.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(notifications.map(n => n.id)));
                }
              }}>
                <Text style={[styles.markAllText, { marginRight: 12 }]}>
                  {selectedIds.size === notifications.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteSelected} disabled={selectedIds.size === 0}>
                <Ionicons name="trash-outline" size={20} color={selectedIds.size > 0 ? "#EF4444" : "#FCA5A5"} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead} activeOpacity={0.7}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearAllButton} 
                  onPress={() => setIsSelectionMode(true)} 
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={17} color="#EF4444" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
`;
// Replace the old headerActions completely
content = content.replace(
  /<View style=\{styles\.headerActions\}>[\s\S]*?<\/View>/m,
  newHeaderActions.trim()
);

// 4. Update the renderItem component to support checkboxes and selection
content = content.replace(
  /onPress=\{\(\) => \{\n\s*if \(\!item\.isRead\) markAsRead\(item\.id\);\n\s*if \(targetScreen\) \{\n\s*try \{\n\s*router\.push\(targetScreen as any\);\n\s*\} catch \(e\) \{\n\s*console\.log\('Error navigating from notification:', e\);\n\s*\}\n\s*\}\n\s*\}\}/,
  `onPress={() => {
          if (isSelectionMode) {
            const newSelected = new Set(selectedIds);
            if (newSelected.has(item.id)) {
              newSelected.delete(item.id);
            } else {
              newSelected.add(item.id);
            }
            setSelectedIds(newSelected);
          } else {
            if (!item.isRead) markAsRead(item.id);
            if (targetScreen) {
              try {
                router.push(targetScreen as any);
              } catch (e) {
                console.log('Error navigating from notification:', e);
              }
            }
          }
        }}`
);

content = content.replace(
  /<View style=\{\[styles\.iconContainer, \{ backgroundColor: iconColor \+ '18' \}\]\}>/,
  `{isSelectionMode && (
          <View style={{ justifyContent: 'center', marginRight: 12 }}>
            <Ionicons 
              name={selectedIds.has(item.id) ? "checkbox" : "square-outline"} 
              size={24} 
              color={selectedIds.has(item.id) ? DEEP_ORANGE : "#9CA3AF"} 
            />
          </View>
        )}
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '18' }]}>`
);

fs.writeFileSync(file, content);
console.log('Update script completed successfully.');
