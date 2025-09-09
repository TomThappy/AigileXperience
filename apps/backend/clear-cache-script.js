// Cache clearing script to run on Render worker
const fs = require('fs/promises');
const path = require('path');

async function clearStepCaches() {
  const cacheDir = path.resolve('cache');
  
  try {
    console.log('🗑️  Starting cache clear operation...');
    
    const cacheFiles = await fs.readdir(cacheDir);
    const stepCacheFiles = cacheFiles.filter(file => 
      file.startsWith('step_') && file.endsWith('.json')
    );
    
    console.log(`Found ${stepCacheFiles.length} step cache files to clear`);
    
    for (const file of stepCacheFiles) {
      await fs.unlink(path.join(cacheDir, file));
      console.log(`Deleted: ${file}`);
    }
    
    console.log(`✅ Cleared ${stepCacheFiles.length} step cache files successfully`);
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
  }
}

// Run the function
clearStepCaches();
