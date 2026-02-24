#!/usr/bin/env python3
"""
Update All SageMaker Endpoints to ml.t3.medium

⚠️  WARNING: ml.t3.medium is a very small instance (2 vCPU, 4GB RAM, no GPU).
This may NOT work for GPU-based models like MedGemma. Test carefully!

Cost: $0.05/hour = ~$36/month per endpoint (vs $1,008/month for ml.g5.2xlarge)
"""

import boto3
import sys
from datetime import datetime

# Configuration
REGION = 'us-east-1'  # Change if needed
NEW_INSTANCE_TYPE = 'ml.t3.medium'

# Your endpoints (from environment variables or config)
# Leave empty to auto-detect all endpoints, or specify manually:
ENDPOINTS = [
    # Uncomment and add your endpoint names if you want to update specific ones:
    # 'medgemma-text-endpoint',
    # 'medgemma-image-endpoint',
    # 'medasr-endpoint',
    # 'hear-endpoint',
    # 'medsiglip-endpoint',
]

def get_all_endpoints(sagemaker):
    """Get all SageMaker endpoints."""
    try:
        response = sagemaker.list_endpoints()
        return [ep['EndpointName'] for ep in response.get('Endpoints', [])]
    except Exception as e:
        print(f"❌ Error listing endpoints: {e}")
        return []

def get_endpoint_info(sagemaker, endpoint_name):
    """Get current endpoint configuration."""
    try:
        endpoint = sagemaker.describe_endpoint(EndpointName=endpoint_name)
        config_name = endpoint['EndpointConfigName']
        config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
        return {
            'endpoint': endpoint,
            'config': config,
            'config_name': config_name,
            'instance_type': config['ProductionVariants'][0]['InstanceType'],
            'model_name': config['ProductionVariants'][0]['ModelName'],
        }
    except Exception as e:
        print(f"❌ Error getting info for {endpoint_name}: {e}")
        return None

def update_endpoint(sagemaker, endpoint_name, new_instance_type):
    """Update a single endpoint to new instance type."""
    print(f"\n{'='*60}")
    print(f"🔄 Processing: {endpoint_name}")
    print(f"{'='*60}")
    
    # Get current info
    info = get_endpoint_info(sagemaker, endpoint_name)
    if not info:
        print(f"❌ Skipping {endpoint_name} - could not get info")
        return False
    
    current_instance = info['instance_type']
    print(f"📊 Current instance: {current_instance}")
    print(f"📊 Model: {info['model_name']}")
    
    if current_instance == new_instance_type:
        print(f"✅ Already using {new_instance_type}. Skipping.")
        return True
    
    # Warn if downgrading from GPU to CPU
    if 'g' in current_instance.lower() or 'p' in current_instance.lower():
        print(f"⚠️  WARNING: Downgrading from GPU instance ({current_instance}) to CPU-only ({new_instance_type})")
        print(f"   This may cause performance issues or failures for GPU-based models!")
    
    # Create new config
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    new_config_name = f"{info['config_name']}-{new_instance_type.replace('.', '-')}-{timestamp}"
    
    variants = info['config']['ProductionVariants']
    new_variants = []
    for variant in variants:
        new_variant = variant.copy()
        new_variant['InstanceType'] = new_instance_type
        new_variants.append(new_variant)
    
    print(f"🔧 Creating new config: {new_config_name}")
    try:
        sagemaker.create_endpoint_config(
            EndpointConfigName=new_config_name,
            ProductionVariants=new_variants
        )
        print(f"✅ Created config: {new_config_name}")
    except Exception as e:
        print(f"❌ Error creating config: {e}")
        return False
    
    # Update endpoint
    print(f"🔄 Updating endpoint (will be unavailable for 10-20 minutes)...")
    try:
        sagemaker.update_endpoint(
            EndpointName=endpoint_name,
            EndpointConfigName=new_config_name
        )
        print(f"✅ Update initiated for {endpoint_name}")
        print(f"   Check status: aws sagemaker describe-endpoint --endpoint-name {endpoint_name}")
        return True
    except Exception as e:
        print(f"❌ Error updating endpoint: {e}")
        return False

def main():
    print("🚀 SageMaker Endpoint Instance Type Updater")
    print(f"   Target instance: {NEW_INSTANCE_TYPE} ($0.05/hour = ~$36/month)")
    print(f"   Region: {REGION}\n")
    
    sagemaker = boto3.client('sagemaker', region_name=REGION)
    
    # Get endpoints
    if ENDPOINTS:
        endpoint_names = ENDPOINTS
        print(f"📋 Using provided endpoint list: {len(endpoint_names)} endpoint(s)")
    else:
        print("📋 Auto-detecting endpoints...")
        endpoint_names = get_all_endpoints(sagemaker)
        print(f"   Found {len(endpoint_names)} endpoint(s)")
    
    if not endpoint_names:
        print("❌ No endpoints found. Exiting.")
        sys.exit(1)
    
    # Show current state
    print("\n📊 Current Endpoint Status:\n")
    total_monthly = 0
    pricing = {
        'ml.t3.medium': 0.05,
        'ml.t3.xlarge': 0.20,
        'ml.g5.xlarge': 0.70,
        'ml.g5.2xlarge': 1.40,
        'ml.p3.2xlarge': 3.06,
    }
    
    for ep_name in endpoint_names:
        info = get_endpoint_info(sagemaker, ep_name)
        if info:
            instance = info['instance_type']
            hourly = pricing.get(instance, 0)
            monthly = hourly * 24 * 30
            total_monthly += monthly
            print(f"  {ep_name}: {instance} = ${monthly:.2f}/month")
    
    new_monthly = 0.05 * 24 * 30 * len(endpoint_names)
    savings = total_monthly - new_monthly
    
    print(f"\n💰 Cost Summary:")
    print(f"   Current total: ${total_monthly:.2f}/month")
    print(f"   New total: ${new_monthly:.2f}/month")
    print(f"   💵 Savings: ${savings:.2f}/month (${savings * 12:.2f}/year)")
    
    # Confirm
    print(f"\n⚠️  WARNING: ml.t3.medium is very small (2 vCPU, 4GB RAM, no GPU)")
    print(f"   GPU-based models (MedGemma) may fail or be very slow!")
    print(f"   This will update {len(endpoint_names)} endpoint(s).")
    print(f"   Each endpoint will be unavailable for 10-20 minutes.\n")
    
    response = input("Continue with update? (yes/no): ")
    if response.lower() != 'yes':
        print("Cancelled.")
        sys.exit(0)
    
    # Update all endpoints
    print(f"\n🔄 Starting updates...\n")
    results = []
    for ep_name in endpoint_names:
        success = update_endpoint(sagemaker, ep_name, NEW_INSTANCE_TYPE)
        results.append((ep_name, success))
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 Update Summary")
    print(f"{'='*60}")
    successful = sum(1 for _, success in results if success)
    failed = len(results) - successful
    
    for ep_name, success in results:
        status = "✅ Success" if success else "❌ Failed"
        print(f"  {status}: {ep_name}")
    
    print(f"\n✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"\n💡 Monitor endpoint status in AWS Console or run:")
    print(f"   aws sagemaker describe-endpoint --endpoint-name <endpoint-name>")
    print(f"\n💰 Expected monthly savings: ${savings:.2f}")

if __name__ == '__main__':
    main()
