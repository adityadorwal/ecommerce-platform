import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Fab,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { createStore } from '../services/api';

function CreateStoreDialog({ onStoreCreated }) {
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('woocommerce');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = () => {
    setOpen(true);
    setStoreName('');
    setStoreType('woocommerce');
    setError('');
  };

  const handleClose = () => {
    if (!creating) {
      setOpen(false);
      setStoreName('');
      setStoreType('woocommerce');
      setError('');
    }
  };

  const handleCreate = async () => {
    if (!storeName.trim()) {
      setError('Store name is required');
      return;
    }

    // Validate store name (lowercase alphanumeric and hyphens)
    const validName = /^[a-z0-9-]+$/;
    if (!validName.test(storeName)) {
      setError('Store name must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await createStore(storeName, storeType);
      setOpen(false);
      setStoreName('');
      setStoreType('woocommerce');
      onStoreCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleOpen}
      >
        <AddIcon />
      </Fab>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Store</DialogTitle>
        <DialogContent>
          <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
            <InputLabel>Store Type</InputLabel>
            <Select
              value={storeType}
              onChange={(e) => setStoreType(e.target.value)}
              label="Store Type"
              disabled={creating}
            >
              <MenuItem value="woocommerce">WooCommerce (WordPress)</MenuItem>
              <MenuItem value="medusa">MedusaJS</MenuItem>
            </Select>
            <FormHelperText>
              {storeType === 'medusa' ? '⚠️ MedusaJS support coming soon!' : 'Full WordPress + WooCommerce e-commerce'}
            </FormHelperText>
          </FormControl>
          
          <TextField
            autoFocus
            margin="dense"
            label="Store Name"
            type="text"
            fullWidth
            variant="outlined"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value.toLowerCase())}
            error={!!error}
            helperText={error || 'Use lowercase letters, numbers, and hyphens only (e.g., "my-store")'}
            disabled={creating}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            variant="contained" 
            disabled={creating}
            startIcon={creating ? <CircularProgress size={20} /> : null}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default CreateStoreDialog;
