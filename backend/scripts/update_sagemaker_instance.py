#!/usr/bin/env python3
"""
SageMaker Endpoint Instance Type Updater

This script helps you change SageMaker endpoint instance types to reduce costs.

Usage:
    python update_sagemaker_instance.py --endpoint-name medgemma-text-endpoint --instance-type ml.g5.xlarge

Requirements:
    pip install boto3
    AWS credentials configured (aws configure or environment variables)
"""

import argparse
import boto3
import sys
from botocore.exceptions import ClientError

def get_current_endpoint_config(sagemaker, endpoint_name):
    """Get current endpoint configuration details."""
    try:
        endpoint = sagemaker.describe_endpoint(EndpointName=endpoint_name)
        config_name = endpoint['EndpointConfigName']
        config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
        return config
    except ClientError as e:
        print(f"Error: {e}")
        sys.exit(1)

def create_new_endpoint_config(sagemaker, current_config, new_instance_type):
    """Create a new endpoint configuration with the new instance type."""
    config_name = current_config['EndpointConfigName']
    new_config_name = f"{config_name}-{new_instance_type.replace('.', '-')}"
    
    # Check if config already exists
    try:
        sagemaker.describe_endpoint_config(EndpointConfigName=new_config_name)
        print(f"⚠️  Config {new_config_name} already exists. Using it.")
        return new_config_name
    except ClientError:
        pass
    
    # Get production variants
    variants = current_config['ProductionVariants']
    
    # Update instance type for all variants
    new_variants = []
    for variant in variants:
        new_variant = variant.copy()
        new_variant['InstanceType'] = new_instance_type
        # Keep other settings (model name, initial count, etc.)
        new_variants.append(new_variant)
    
    try:
        # Create new endpoint config
        create_params = {
            'EndpointConfigName': new_config_name,
            'ProductionVariants': new_variants
        }
        
        # Copy tags if they exist
        if 'Tags' in current_config:
            create_params['Tags'] = current_config['Tags']
        
        sagemaker.create_endpoint_config(**create_params)
        print(f"✅ Created new endpoint configuration: {new_config_name}")
        return new_config_name
    except ClientError as e:
        print(f"❌ Error creating config: {e}")
        sys.exit(1)

def update_endpoint(sagemaker, endpoint_name, new_config_name, wait=False):
    """Update endpoint to use new configuration."""
    try:
        print(f"🔄 Updating endpoint {endpoint_name} to use {new_config_name}...")
        sagemaker.update_endpoint(
            EndpointName=endpoint_name,
            EndpointConfigName=new_config_name
        )
        print(f"✅ Endpoint update initiated!")
        
        if wait:
            print("⏳ Waiting for endpoint to update (this may take 10-20 minutes)...")
            waiter = sagemaker.get_waiter('endpoint_in_service')
            waiter.wait(EndpointName=endpoint_name)
            print("✅ Endpoint is now in service with new instance type!")
        else:
            print("💡 Check endpoint status in AWS Console. Update takes 10-20 minutes.")
            print(f"   Run: aws sagemaker describe-endpoint --endpoint-name {endpoint_name}")
    except ClientError as e:
        print(f"❌ Error updating endpoint: {e}")
        sys.exit(1)

def list_endpoints(sagemaker):
    """List all SageMaker endpoints."""
    try:
        response = sagemaker.list_endpoints()
        endpoints = response.get('Endpoints', [])
        
        if not endpoints:
            print("No endpoints found.")
            return
        
        print("\n📋 Available SageMaker Endpoints:\n")
        for endpoint in endpoints:
            endpoint_name = endpoint['EndpointName']
            status = endpoint['EndpointStatus']
            
            # Get instance type
            try:
                config = get_current_endpoint_config(sagemaker, endpoint_name)
                instance_type = config['ProductionVariants'][0]['InstanceType']
                print(f"  • {endpoint_name}")
                print(f"    Status: {status}")
                print(f"    Instance: {instance_type}")
                print()
            except:
                print(f"  • {endpoint_name} (Status: {status})")
                print()
    except ClientError as e:
        print(f"Error listing endpoints: {e}")

def main():
    parser = argparse.ArgumentParser(
        description='Update SageMaker endpoint instance types to reduce costs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all endpoints
  python update_sagemaker_instance.py --list

  # Update a single endpoint
  python update_sagemaker_instance.py --endpoint-name medgemma-text --instance-type ml.g5.xlarge

  # Update and wait for completion
  python update_sagemaker_instance.py --endpoint-name medgemma-text --instance-type ml.g5.xlarge --wait

Recommended instance types:
  - ml.g5.xlarge (50% cheaper than g5.2xlarge, good performance)
  - ml.g4dn.xlarge (62% cheaper, good for vision)
  - ml.t3.xlarge (85% cheaper, for light workloads)
        """
    )
    parser.add_argument('--endpoint-name', help='SageMaker endpoint name')
    parser.add_argument('--instance-type', help='New instance type (e.g., ml.g5.xlarge)')
    parser.add_argument('--region', default='us-east-1', help='AWS region (default: us-east-1)')
    parser.add_argument('--list', action='store_true', help='List all endpoints')
    parser.add_argument('--wait', action='store_true', help='Wait for endpoint update to complete')
    
    args = parser.parse_args()
    
    sagemaker = boto3.client('sagemaker', region_name=args.region)
    
    if args.list:
        list_endpoints(sagemaker)
        return
    
    if not args.endpoint_name or not args.instance_type:
        parser.print_help()
        sys.exit(1)
    
    # Validate instance type format
    if not args.instance_type.startswith('ml.'):
        print(f"⚠️  Warning: Instance type '{args.instance_type}' doesn't start with 'ml.'")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    print(f"🔍 Getting current configuration for {args.endpoint_name}...")
    current_config = get_current_endpoint_config(sagemaker, args.endpoint_name)
    
    current_instance = current_config['ProductionVariants'][0]['InstanceType']
    print(f"📊 Current instance type: {current_instance}")
    print(f"🎯 New instance type: {args.instance_type}")
    
    if current_instance == args.instance_type:
        print("⚠️  Instance type is already set to this value. No change needed.")
        sys.exit(0)
    
    # Confirm
    print(f"\n⚠️  This will update endpoint '{args.endpoint_name}' from {current_instance} to {args.instance_type}")
    print("   The endpoint will be unavailable for 10-20 minutes during update.")
    response = input("Continue? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        sys.exit(0)
    
    # Create new config
    new_config_name = create_new_endpoint_config(sagemaker, current_config, args.instance_type)
    
    # Update endpoint
    update_endpoint(sagemaker, args.endpoint_name, new_config_name, wait=args.wait)
    
    print("\n✅ Done! Monitor costs in AWS Cost Explorer.")

if __name__ == '__main__':
    main()
